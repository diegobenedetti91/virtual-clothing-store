import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAutomaticShipment } from "@/lib/shipmentUtils";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Buscar pedidos com erro retentável
    const ordersWithErrors = await prisma.order.findMany({
      where: {
        shipmentRetryableError: true,
        melhorEnvioShipmentId: null, // Ainda não tem etiqueta criada
      },
      select: {
        id: true,
        orderNumber: true,
        shipmentAttempts: true,
        shipmentRetryError: true,
      },
      orderBy: { lastShipmentAttempt: "asc" },
    });

    console.log(`[SHIPMENT RETRY] Found ${ordersWithErrors.length} orders to retry`);

    let successful = 0;
    let failed = 0;
    const results: Array<{ orderNumber: string; status: string; message: string }> = [];

    for (const order of ordersWithErrors) {
      try {
        console.log(`[SHIPMENT RETRY] Attempting to create shipment for ${order.orderNumber}`);
        await createAutomaticShipment(order.id);

        // Se conseguiu, limpar os campos de erro
        await prisma.order.update({
          where: { id: order.id },
          data: {
            shipmentRetryableError: false,
            shipmentRetryError: null,
          },
        });

        successful++;
        results.push({
          orderNumber: order.orderNumber,
          status: "success",
          message: "Etiqueta criada com sucesso na tentativa",
        });
        console.log(`[SHIPMENT RETRY] Success for ${order.orderNumber}`);
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);

        // Atualizar tentativa
        await prisma.order.update({
          where: { id: order.id },
          data: {
            shipmentRetryError: errorMsg,
          },
        });

        results.push({
          orderNumber: order.orderNumber,
          status: "failed",
          message: errorMsg,
        });
        console.error(`[SHIPMENT RETRY] Failed for ${order.orderNumber}: ${errorMsg}`);
      }
    }

    return NextResponse.json({
      success: true,
      total: ordersWithErrors.length,
      successful,
      failed,
      results,
      message: `Processados ${ordersWithErrors.length} pedidos: ${successful} sucesso, ${failed} falha`,
    });
  } catch (error) {
    console.error("[SHIPMENT RETRY] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST para processar um pedido específico
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    try {
      console.log(`[SHIPMENT RETRY] Manual retry for ${order.orderNumber}`);

      // Clear previous shipment data to allow retry
      await prisma.order.update({
        where: { id: orderId },
        data: {
          melhorEnvioShipmentId: null,
          trackingCode: null,
          trackingUrl: null,
          etiquetaUrl: null,
          shipmentStatus: null,
          labelValidatedAt: null,
          labelValid: null,
          labelError: null,
        },
      });

      await createAutomaticShipment(order.id);

      // Limpar erros se sucesso
      await prisma.order.update({
        where: { id: order.id },
        data: {
          shipmentRetryableError: false,
          shipmentRetryError: null,
        },
      });

      // Fetch updated order with all details
      const updatedOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { product: true } },
          trackingEvents: { orderBy: { timestamp: "desc" } },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Etiqueta criada com sucesso para ${order.orderNumber}`,
        ...updatedOrder,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Salvar nova tentativa
      await prisma.order.update({
        where: { id: order.id },
        data: {
          shipmentRetryError: errorMsg,
        },
      });

      return NextResponse.json(
        {
          success: false,
          message: `Falha ao criar etiqueta: ${errorMsg}`,
          error: errorMsg,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[SHIPMENT RETRY] Error:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Internal server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}
