import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromRequest } from "@/lib/customerAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const customer = getCustomerFromRequest(req);

    if (!customer) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Verificar se customer é dono do pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.customerId !== customer.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Buscar devoluções aprovadas para este pedido
    const approvedReturns = await prisma.return.findMany({
      where: { orderId, status: "APPROVED" },
    });

    // Calcular quantidades devolvidas por item
    const returnedQuantities: Record<string, number> = {};

    for (const ret of approvedReturns) {
      if (ret.returnedItems && typeof ret.returnedItems === "object") {
        for (const item of ret.returnedItems as any[]) {
          returnedQuantities[item.itemId] =
            (returnedQuantities[item.itemId] || 0) + item.quantity;
        }
      }
    }

    return NextResponse.json(returnedQuantities);
  } catch (error) {
    console.error("[returned-items] GET error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar devoluções" },
      { status: 500 }
    );
  }
}
