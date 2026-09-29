import { prisma } from "@/lib/prisma";
import { sendEmailStatusChanged } from "@/lib/email";

type TimelineEvent = { status: string; location?: string; date: string; detail?: string };

export type ShipmentUpdate = {
  shipmentStatus: string;
  trackingCode?: string | null;
  timeline?: TimelineEvent[];
};

// Melhor Envio uses "posted" once the carrier has the package; "in_transit" kept for legacy data.
const SHIPPED_STATUSES = new Set(["posted", "in_transit"]);
const PROBLEM_STATUSES = new Set(["undelivered", "exception"]);

export function orderStatusForShipment(shipmentStatus: string, currentOrderStatus: string): string | null {
  if (shipmentStatus === "delivered" && (currentOrderStatus === "CONFIRMED" || currentOrderStatus === "SHIPPED")) {
    return "DELIVERED";
  }
  if (SHIPPED_STATUSES.has(shipmentStatus) && currentOrderStatus === "CONFIRMED") {
    return "SHIPPED";
  }
  return null;
}

export async function applyShipmentUpdate(orderId: string, update: ShipmentUpdate, storeName: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      shipmentStatus: true,
      trackingCode: true,
      customerEmail: true,
      customerName: true,
    },
  });
  if (!order) return { shipmentStatusChanged: false, orderStatusChanged: false };

  const shipmentStatusChanged = order.shipmentStatus !== update.shipmentStatus;

  await prisma.order.update({
    where: { id: order.id },
    data: {
      shipmentStatus: update.shipmentStatus,
      lastTrackingUpdate: new Date(),
      ...(update.trackingCode && !order.trackingCode && { trackingCode: update.trackingCode }),
    },
  });

  // Conditional on the current status so webhook and cron can't both apply (and email) the same transition.
  let orderStatusChanged = false;
  const newOrderStatus = orderStatusForShipment(update.shipmentStatus, order.status);
  if (newOrderStatus) {
    const result = await prisma.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: newOrderStatus },
    });
    orderStatusChanged = result.count > 0;
    if (orderStatusChanged) {
      console.log(`[TRACKING SYNC] ${order.orderNumber}: ${order.status} → ${newOrderStatus} (shipment: ${update.shipmentStatus})`);
    }
  }

  if (update.timeline && Array.isArray(update.timeline)) {
    for (const event of update.timeline) {
      const timestamp = new Date(event.date);
      const exists = await prisma.trackingEvent.findFirst({
        where: { orderId: order.id, status: event.status, timestamp },
      });
      if (!exists) {
        await prisma.trackingEvent.create({
          data: {
            orderId: order.id,
            status: event.status,
            location: event.location || undefined,
            timestamp,
            details: event.detail || undefined,
          },
        });
      }
    }
  }

  if (order.customerEmail) {
    let email: { newStatus: string; message: string } | null = null;
    if (orderStatusChanged && newOrderStatus === "SHIPPED") {
      email = { newStatus: "in_transit", message: "Seu pacote foi coletado pela transportadora e está a caminho!" };
    } else if (orderStatusChanged && newOrderStatus === "DELIVERED") {
      email = { newStatus: "delivered", message: "Seu pacote foi entregue com sucesso!" };
    } else if (shipmentStatusChanged && PROBLEM_STATUSES.has(update.shipmentStatus)) {
      email = { newStatus: "exception", message: "Ocorreu um problema na entrega. Nossa equipe está cuidando disso." };
    }

    if (email) {
      await sendEmailStatusChanged({
        to: order.customerEmail,
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        storeName,
        ...email,
      }).catch((err) => console.error(`[TRACKING SYNC] Failed to send email for ${order.orderNumber}:`, err));
    }
  }

  return { shipmentStatusChanged, orderStatusChanged };
}
