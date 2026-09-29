import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMelhorEnvioTracking } from "@/lib/melhorEnvio";
import { applyShipmentUpdate } from "@/lib/trackingSync";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    console.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
    // Shipments are created with melhorEnvioApiToken, so tracking must use the same token.
    const token = settings?.melhorEnvioApiToken || settings?.melhorEnvioToken;

    if (!token) {
      console.warn("Melhor Envio token not configured");
      return NextResponse.json({ error: "Not configured", updated: 0 }, { status: 400 });
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
        lastTrackingUpdate: true,
      },
    });

    console.log(`[TRACKING CRON] Found ${orders.length} orders to update`);

    const storeName = settings?.name || "Minha Loja";
    let updated = 0;
    let errors = 0;
    let statusChanged = 0;

    for (const order of orders) {
      const lastUpdate = order.lastTrackingUpdate?.getTime() || 0;
      const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
      if (lastUpdate > sixHoursAgo) {
        console.log(`[TRACKING CRON] Skipping ${order.orderNumber} - updated recently`);
        continue;
      }

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
    });
  } catch (error) {
    console.error("[TRACKING CRON] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error", success: false, updated: 0 }, { status: 500 });
  }
}
