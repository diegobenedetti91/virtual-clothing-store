import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMelhorEnvioTracking } from "@/lib/melhorEnvio";
import { sendEmailStatusChanged } from "@/lib/email";

export async function GET(req: NextRequest) {
  // Validar cron secret
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    console.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await prisma.companySettings.findFirst();

    if (!settings?.melhorEnvioToken) {
      console.warn("Melhor Envio token not configured");
      return NextResponse.json({ error: "Not configured", updated: 0 }, { status: 400 });
    }

    // Buscar pedidos com shipment ID mas não entregues
    const orders = await prisma.order.findMany({
      where: {
        melhorEnvioShipmentId: { not: null },
        shipmentStatus: { not: "delivered" },
      },
      select: {
        id: true,
        orderNumber: true,
        melhorEnvioShipmentId: true,
        lastTrackingUpdate: true,
        shipmentStatus: true,
        customerEmail: true,
        customerName: true,
      },
    });

    console.log(`[TRACKING CRON] Found ${orders.length} orders to update`);

    let updated = 0;
    let errors = 0;
    let statusChanged = 0;

    for (const order of orders) {
      // Atualizar apenas a cada 6 horas
      const lastUpdate = order.lastTrackingUpdate?.getTime() || 0;
      const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
      if (lastUpdate > sixHoursAgo) {
        console.log(`[TRACKING CRON] Skipping ${order.orderNumber} - updated recently`);
        continue;
      }

      try {
        const tracking = await getMelhorEnvioTracking(
          settings.melhorEnvioToken,
          order.melhorEnvioShipmentId!
        );

        // Detectar mudança de status
        const hasStatusChanged = order.shipmentStatus !== tracking.status;

        // Atualizar status do envio
        await prisma.order.update({
          where: { id: order.id },
          data: {
            shipmentStatus: tracking.status,
            lastTrackingUpdate: new Date(),
          },
        });

        // Notificar cliente se status mudou para importante
        if (hasStatusChanged && order.customerEmail) {
          console.log(`[TRACKING CRON] Status changed for ${order.orderNumber}: ${order.shipmentStatus} → ${tracking.status}`);

          // Enviar email quando transportadora coleta
          if (tracking.status === "in_transit") {
            try {
              await sendEmailStatusChanged({
                to: order.customerEmail,
                customerName: order.customerName,
                orderNumber: order.orderNumber,
                newStatus: "in_transit",
                message: "Seu pacote foi coletado pela transportadora e está a caminho!",
                storeName: settings.name || "Minha Loja",
              });
              console.log(`[TRACKING CRON] In-transit email sent to ${order.customerEmail}`);
            } catch (emailErr) {
              console.error(`[TRACKING CRON] Failed to send in-transit email:`, emailErr);
            }
          }

          // Enviar email quando entregue
          if (tracking.status === "delivered") {
            try {
              await sendEmailStatusChanged({
                to: order.customerEmail,
                customerName: order.customerName,
                orderNumber: order.orderNumber,
                newStatus: "delivered",
                message: "Seu pacote foi entregue com sucesso!",
                storeName: settings.name || "Minha Loja",
              });
              console.log(`[TRACKING CRON] Delivery email sent to ${order.customerEmail}`);
            } catch (emailErr) {
              console.error(`[TRACKING CRON] Failed to send delivery email:`, emailErr);
            }
          }

          statusChanged++;
        }

        // Adicionar eventos de rastreamento se houver timeline
        if (tracking.timeline && Array.isArray(tracking.timeline)) {
          for (const event of tracking.timeline) {
            // Verificar se o evento já existe
            const exists = await prisma.trackingEvent.findFirst({
              where: {
                orderId: order.id,
                status: event.status,
                timestamp: new Date(event.date),
              },
            });

            if (!exists) {
              await prisma.trackingEvent.create({
                data: {
                  orderId: order.id,
                  status: event.status,
                  location: event.location || undefined,
                  timestamp: new Date(event.date),
                  details: event.detail || undefined,
                },
              });
            }
          }
        }

        updated++;
        console.log(`[TRACKING CRON] Updated ${order.orderNumber}`);
      } catch (error) {
        errors++;
        console.error(
          `[TRACKING CRON] Failed to update tracking for order ${order.orderNumber}:`,
          error
        );
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      errors,
      statusChanged,
      total: orders.length,
      message: `Updated ${updated}/${orders.length} orders${errors > 0 ? ` with ${errors} errors` : ""}${statusChanged > 0 ? `, ${statusChanged} status changes notified` : ""}`,
    });
  } catch (error) {
    console.error("[TRACKING CRON] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        success: false,
        updated: 0,
      },
      { status: 500 }
    );
  }
}
