import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmailStatusChanged } from "@/lib/email";

interface MelhorEnvioWebhookPayload {
  id: string;
  status: string;
  tracking: string;
  timeline?: Array<{
    status: string;
    location?: string;
    date: string;
    detail: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[MELHOR ENVIO WEBHOOK] Received:", JSON.stringify(body, null, 2));

    // Melhor Envio envia um array de eventos
    const events = Array.isArray(body) ? body : [body];

    for (const event of events) {
      await processWebhookEvent(event);
    }

    return NextResponse.json({ success: true, processed: events.length });
  } catch (error) {
    console.error("[MELHOR ENVIO WEBHOOK] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

async function processWebhookEvent(event: MelhorEnvioWebhookPayload) {
  try {
    console.log(`[WEBHOOK] Processing shipment ${event.id} with status ${event.status}`);

    // Buscar pedido pelo shipment ID
    const order = await prisma.order.findFirst({
      where: { melhorEnvioShipmentId: event.id },
      select: {
        id: true,
        orderNumber: true,
        customerEmail: true,
        customerName: true,
        shipmentStatus: true,
      },
    });

    if (!order) {
      console.log(`[WEBHOOK] No order found for shipment ${event.id}`);
      return;
    }

    // Detectar mudança de status
    const statusChanged = order.shipmentStatus !== event.status;

    if (!statusChanged) {
      console.log(`[WEBHOOK] Status unchanged for ${order.orderNumber}`);
      return;
    }

    console.log(
      `[WEBHOOK] Status change detected for ${order.orderNumber}: ${order.shipmentStatus} → ${event.status}`
    );

    // Mapear shipmentStatus para status principal do pedido
    let newOrderStatus = undefined;
    if (event.status === "in_transit") {
      newOrderStatus = "SHIPPED";
    } else if (event.status === "delivered") {
      newOrderStatus = "DELIVERED";
    }

    // Atualizar status
    await prisma.order.update({
      where: { id: order.id },
      data: {
        shipmentStatus: event.status,
        lastTrackingUpdate: new Date(),
        ...(newOrderStatus && { status: newOrderStatus }),
      },
    });

    // Adicionar eventos de rastreamento se houver timeline
    if (event.timeline && Array.isArray(event.timeline)) {
      for (const timelineEvent of event.timeline) {
        const exists = await prisma.trackingEvent.findFirst({
          where: {
            orderId: order.id,
            status: timelineEvent.status,
            timestamp: new Date(timelineEvent.date),
          },
        });

        if (!exists) {
          await prisma.trackingEvent.create({
            data: {
              orderId: order.id,
              status: timelineEvent.status,
              location: timelineEvent.location || undefined,
              timestamp: new Date(timelineEvent.date),
              details: timelineEvent.detail || undefined,
            },
          });
        }
      }
    }

    // Notificar cliente se for status importante
    if (order.customerEmail) {
      try {
        if (event.status === "in_transit") {
          await sendEmailStatusChanged({
            to: order.customerEmail,
            customerName: order.customerName,
            orderNumber: order.orderNumber,
            newStatus: "in_transit",
            message: "Seu pacote foi coletado pela transportadora e está a caminho!",
            storeName: "Minha Loja",
          });
          console.log(`[WEBHOOK] Email sent to ${order.customerEmail} (in_transit)`);
        } else if (event.status === "delivered") {
          await sendEmailStatusChanged({
            to: order.customerEmail,
            customerName: order.customerName,
            orderNumber: order.orderNumber,
            newStatus: "delivered",
            message: "Seu pacote foi entregue com sucesso!",
            storeName: "Minha Loja",
          });
          console.log(`[WEBHOOK] Email sent to ${order.customerEmail} (delivered)`);
        } else if (event.status === "exception") {
          await sendEmailStatusChanged({
            to: order.customerEmail,
            customerName: order.customerName,
            orderNumber: order.orderNumber,
            newStatus: "exception",
            message: "Ocorreu um problema na entrega. Nossa equipe está cuidando disso.",
            storeName: "Minha Loja",
          });
          console.log(`[WEBHOOK] Email sent to ${order.customerEmail} (exception)`);
        }
      } catch (emailErr) {
        console.error(`[WEBHOOK] Failed to send email:`, emailErr);
      }
    }

    console.log(`[WEBHOOK] Successfully processed ${order.orderNumber}`);
  } catch (error) {
    console.error(`[WEBHOOK] Error processing event:`, error);
  }
}

// GET para testar se webhook está configurado
export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: "ok",
    message: "Webhook do Melhor Envio está ativo",
    endpoint: "/api/webhooks/melhorenvio",
  });
}
