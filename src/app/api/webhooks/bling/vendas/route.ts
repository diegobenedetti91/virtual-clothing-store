import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { integrarPedidoBling } from "@/lib/blingService";

export async function POST(req: NextRequest) {
  // Optional shared secret: configure the webhook URL in Bling as
  // /api/webhooks/bling/vendas?token=<BLING_WEBHOOK_TOKEN>
  const expectedToken = process.env.BLING_WEBHOOK_TOKEN;
  if (expectedToken && req.nextUrl.searchParams.get("token") !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    console.log("[Webhook Bling] Recebido evento:", data?.evento, data?.id);

    const evento = data.evento;
    const pedidoId = data.id;

    if (evento === "pedido.criado" || evento === "pedido.atualizado") {
      const pedido = data.pedido;
      const numeroVenda = pedido?.numero;

      if (numeroVenda) {
        const order = await prisma.order.findUnique({
          where: { orderNumber: numeroVenda },
        });

        // Only paid orders go to Bling, whatever the webhook says
        const PAID = ["CONFIRMED", "SHIPPED", "PRONTO_PARA_RETIRADA", "RETIRADO", "DELIVERED"];
        if (order && !order.blingPedidoId && PAID.includes(order.status)) {
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
