import { NextRequest, NextResponse } from "next/server";
import { integrarPedidoBling } from "@/lib/blingService";

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    console.log("[Admin] Tentando integrar pedido manualmente:", orderId);

    const result = await integrarPedidoBling(orderId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Pedido integrado com sucesso ao Bling",
        blingId: result.blingId,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 400 });
    }
  } catch (error) {
    console.error("[Admin] Erro ao integrar pedido:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
