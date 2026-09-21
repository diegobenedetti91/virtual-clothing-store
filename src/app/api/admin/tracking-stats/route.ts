import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    // Verificar se é admin
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Buscar todos os pedidos com shipment
    const orders = await prisma.order.findMany({
      where: {
        melhorEnvioShipmentId: { not: null },
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        trackingCode: true,
        shipmentStatus: true,
        labelValid: true,
        labelError: true,
        createdAt: true,
        melhorEnvioShipmentId: true,
        trackingEvents: {
          orderBy: { timestamp: "desc" },
          take: 1,
          select: {
            status: true,
            timestamp: true,
            location: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Buscar também pedidos com erro de shipment
    const ordersWithShipmentErrors = await prisma.order.findMany({
      where: {
        shipmentRetryableError: true,
        melhorEnvioShipmentId: null,
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        shipmentRetryError: true,
      },
    });

    // Calcular estatísticas
    const stats = {
      labelInvalid: orders.filter((o) => o.labelValid === false).length,
      posted: orders.filter((o) => o.shipmentStatus === "posted").length,
      inTransit: orders.filter((o) => o.shipmentStatus === "in_transit").length,
      delivered: orders.filter((o) => o.shipmentStatus === "delivered").length,
      exception: orders.filter((o) => o.shipmentStatus === "exception").length,
      cancelled: orders.filter((o) => o.shipmentStatus === "cancelled").length,
      pending: orders.filter((o) => !o.shipmentStatus).length,
      shipmentErrors: ordersWithShipmentErrors.length,
    };

    return NextResponse.json({
      stats,
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        trackingCode: order.trackingCode,
        shipmentStatus: order.shipmentStatus,
        labelValid: order.labelValid,
        labelError: order.labelError,
        createdAt: order.createdAt,
        trackingEvents: order.trackingEvents,
        melhorEnvioShipmentId: order.melhorEnvioShipmentId,
      })),
      shipmentErrors: ordersWithShipmentErrors.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        error: order.shipmentRetryError,
      })),
    });
  } catch (error) {
    console.error("[TRACKING STATS] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
