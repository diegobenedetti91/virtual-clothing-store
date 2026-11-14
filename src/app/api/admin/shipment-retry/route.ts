import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { SHIPMENT_ERROR_WHERE } from "@/lib/shipmentUtils";
import { prepararEtiqueta } from "@/lib/labelPipeline";
import { needsMelhorEnvioLabel } from "@/lib/utils";

/**
 * Leva a etiqueta até "pronta para imprimir" (cria, paga, gera e salva o PDF), continuando de onde parou.
 * Lança erro com a mensagem amigável quando não deu.
 */
async function generateLabel(orderId: string) {
  const r = await prepararEtiqueta(orderId);
  if (!r.ok) throw new Error(r.message);
  return r;
}

// GET: tenta novamente todos os pedidos com erro de etiqueta
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const ordersWithErrors = await prisma.order.findMany({
      where: SHIPMENT_ERROR_WHERE,
      select: { id: true, orderNumber: true, shippingMethod: true },
      orderBy: { lastShipmentAttempt: "asc" },
    });

    console.log(`[SHIPMENT RETRY] Found ${ordersWithErrors.length} orders to retry`);

    let successful = 0;
    let failed = 0;
    const results: Array<{ orderNumber: string; status: string; message: string }> = [];

    for (const order of ordersWithErrors) {
      if (!needsMelhorEnvioLabel(order.shippingMethod)) continue;
      try {
        console.log(`[SHIPMENT RETRY] Attempting to create shipment for ${order.orderNumber}`);
        await generateLabel(order.id);
        successful++;
        results.push({ orderNumber: order.orderNumber, status: "success", message: "Etiqueta pronta" });
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ orderNumber: order.orderNumber, status: "failed", message: errorMsg });
        console.error(`[SHIPMENT RETRY] Failed for ${order.orderNumber}: ${errorMsg}`);
      }
    }

    return NextResponse.json({
      success: true,
      total: successful + failed,
      successful,
      failed,
      results,
      message: `Processados ${successful + failed} pedidos: ${successful} sucesso, ${failed} falha`,
    });
  } catch (error) {
    console.error("[SHIPMENT RETRY] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: gera (ou recria, se inválida) a etiqueta de um pedido específico
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ success: false, error: "orderId is required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        shippingMethod: true,
        melhorEnvioShipmentId: true,
        labelValid: true,
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Pedido não encontrado" }, { status: 404 });
    }
    if (order.status === "PENDING" || order.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "Só é possível gerar etiqueta para pedidos pagos" },
        { status: 400 }
      );
    }
    if (!needsMelhorEnvioLabel(order.shippingMethod)) {
      return NextResponse.json(
        { success: false, error: "Este pedido é entrega local/retirada e não usa etiqueta" },
        { status: 400 }
      );
    }
    // Etiqueta válida já existente nunca é descartada (geraria outra paga): só continua de onde parou

    try {
      console.log(`[SHIPMENT RETRY] Manual retry for ${order.orderNumber}`);

      if (order.melhorEnvioShipmentId && order.labelValid === false) {
        // Etiqueta inválida (cancelada/expirada): limpa para permitir criar outra
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
            labelFile: null,
            labelPrintUrl: null,
            labelGeneratedAt: null,
            labelPrintedAt: null,
            labelStepError: null,
          },
        });
      }

      const done = await generateLabel(order.id);

      const updatedOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { product: true } },
          trackingEvents: { orderBy: { timestamp: "desc" } },
        },
      });

      return NextResponse.json({
        ...updatedOrder,
        success: true,
        message: done.message,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { success: false, message: errorMsg, error: errorMsg },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[SHIPMENT RETRY] Error:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: `Internal server error: ${errorMsg}` }, { status: 500 });
  }
}
