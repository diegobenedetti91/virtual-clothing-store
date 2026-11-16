import { expirePendingOrders } from "@/lib/expirePendingOrders";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMelhorEnvioTracking } from "@/lib/melhorEnvio";
import { applyShipmentUpdate } from "@/lib/trackingSync";
import { processarEtiquetasPendentes } from "@/lib/labelPipeline";
import { processCashbackNotifications } from "@/lib/cashback";
import { processFlashSaleNotifications } from "@/lib/promoInterest";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    console.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Aproveita a rotina que já roda para destravar etiquetas (sem saldo, falta gerar/baixar o PDF)
  const labels = await processarEtiquetasPendentes().catch((e) => {
    console.error("[cron/update-tracking] etiquetas:", e);
    return null;
  });
  if (labels?.tried) console.log(`[cron/update-tracking] etiquetas: ${labels.ready}/${labels.tried} prontas`);
  // E os avisos de cashback (liberado / vencendo)
  const cashback = await processCashbackNotifications().catch((e) => { console.error("[cron/update-tracking] cashback:", e); return null; });
  // E os avisos automáticos de promoção relâmpago que começaram
  const promo = await processFlashSaleNotifications().then(() => "ok").catch((e) => { console.error("[cron/update-tracking] promo:", e); return "erro"; });
  // E expira pedidos de gateway não pagos há mais de 24h (confere no gateway antes)
  const expired = await expirePendingOrders().catch((e) => { console.error("[cron/update-tracking] expirar pendentes:", e); return null; });

  // Resumo de cada parte, para aparecer na saída do agendamento
  const routines = {
    etiquetas: labels ? `${labels.ready}/${labels.tried} prontas` : "erro",
    cashback: cashback ? `${cashback.released} liberados, ${cashback.expiring} vencendo` : "erro",
    promocao: promo,
    pedidosExpirados: expired
      ? {
          conferidos: expired.checked,
          cancelados: expired.cancelled,
          confirmadosPagos: expired.confirmed,
          aguardandoBoleto: expired.waiting,
          naoConferidos: expired.skipped,
        }
      : "erro",
  };

  try {
    const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
    // Shipments are created with melhorEnvioApiToken, so tracking must use the same token.
    const token = settings?.melhorEnvioApiToken || settings?.melhorEnvioToken;

    if (!token) {
      console.warn("Melhor Envio token not configured");
      // Loja sem Melhor Envio: o resto da rotina já rodou; não é falha do agendamento
      return NextResponse.json({ ok: true, tracking: "Melhor Envio não configurado — rastreio não atualizado", updated: 0, routines });
    }

    const orders = await prisma.order.findMany({
      where: {
        melhorEnvioShipmentId: { not: null },
        OR: [
          { shipmentStatus: { notIn: ["delivered", "canceled", "cancelled"] } },
          // Already delivered at Melhor Envio but order status never caught up
          { shipmentStatus: "delivered", status: { in: ["CONFIRMED", "SHIPPED"] } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        melhorEnvioShipmentId: true,
      },
    });

    console.log(`[TRACKING CRON] Found ${orders.length} orders to update`);

    const storeName = settings?.name || "Minha Loja";
    let updated = 0;
    let errors = 0;
    let statusChanged = 0;

    for (const order of orders) {
      try {
        const tracking = await getMelhorEnvioTracking(token, order.melhorEnvioShipmentId!);

        const result = await applyShipmentUpdate(
          order.id,
          { shipmentStatus: tracking.status, trackingCode: tracking.tracking, timeline: tracking.timeline },
          storeName
        );

        if (result.orderStatusChanged) statusChanged++;
        updated++;
        console.log(`[TRACKING CRON] Updated ${order.orderNumber} (shipment: ${tracking.status})`);
      } catch (error) {
        errors++;
        console.error(`[TRACKING CRON] Failed to update tracking for order ${order.orderNumber}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      errors,
      statusChanged,
      total: orders.length,
      message: `Updated ${updated}/${orders.length} orders${errors > 0 ? ` with ${errors} errors` : ""}${statusChanged > 0 ? `, ${statusChanged} order status changes` : ""}`,
      routines,
    });
  } catch (error) {
    console.error("[TRACKING CRON] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error", success: false, updated: 0, routines }, { status: 500 });
  }
}
