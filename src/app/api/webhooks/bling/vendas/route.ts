import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { integrarPedidoBling } from "@/lib/blingService";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    console.log("[Webhook Bling] Recebido evento:", JSON.stringify(data, null, 2));

    const evento = data.evento;
    const pedidoId = data.id;

    if (evento === "pedido.criado" || evento === "pedido.atualizado") {
      const pedido = data.pedido;
      const numeroVenda = pedido?.numero;

      if (numeroVenda) {
        const order = await prisma.order.findUnique({
          where: { orderNumber: numeroVenda },
        });

        if (order && !order.blingPedidoId) {
          await integrarPedidoBling(order.id);
        }
      }
    }

    return NextResponse.json({ success: true, message: "Webhook processado" });
  } catch (error) {
    console.error("[Webhook Bling] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao processar webhook" },
      { status: 500 }
    );
  }
}
