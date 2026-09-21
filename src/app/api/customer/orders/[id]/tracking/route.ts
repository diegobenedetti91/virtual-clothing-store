import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromCookie } from "@/lib/customerAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await getCustomerFromCookie();

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        customerEmail: true,
        melhorEnvioShipmentId: true,
        trackingCode: true,
        trackingUrl: true,
        etiquetaUrl: true,
        shipmentStatus: true,
        labelValid: true,
        labelError: true,
        lastTrackingUpdate: true,
        trackingEvents: {
          orderBy: { timestamp: "desc" },
          select: {
            status: true,
            location: true,
            timestamp: true,
            details: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verificar se cliente tem permissão
    if (payload && order.customerId !== payload.id && order.customerEmail !== payload.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Se não tem tracking, retornar dados básicos
    if (!order.melhorEnvioShipmentId) {
      return NextResponse.json({
        orderNumber: order.orderNumber,
        shipmentStatus: null,
        message: "Etiqueta ainda não foi gerada",
        trackingCode: null,
        trackingUrl: null,
        trackingEvents: [],
      });
    }

    return NextResponse.json({
      orderNumber: order.orderNumber,
      shipmentStatus: order.shipmentStatus,
      trackingCode: order.trackingCode,
      trackingUrl: order.trackingUrl,
      etiquetaUrl: order.etiquetaUrl,
      labelValid: order.labelValid,
      labelError: order.labelError,
      lastTrackingUpdate: order.lastTrackingUpdate,
      trackingEvents: order.trackingEvents,
      message: getStatusMessage(order.shipmentStatus),
    });
  } catch (error) {
    console.error("Error fetching tracking:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getStatusMessage(status: string | null): string {
  switch (status) {
    case "posted":
      return "Sua etiqueta foi gerada! Aguardamos a coleta pela transportadora.";
    case "in_transit":
      return "Seu pacote está em trânsito para entrega.";
    case "delivered":
      return "Seu pacote foi entregue com sucesso!";
    case "returned":
      return "Seu pacote foi devolvido.";
    case "exception":
      return "Houve um problema na entrega. Contate o suporte.";
    case "cancelled":
      return "O envio foi cancelado.";
    default:
      return "Processando seu pedido...";
  }
}
