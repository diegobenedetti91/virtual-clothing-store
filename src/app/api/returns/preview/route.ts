import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromRequest } from "@/lib/customerAuth";
import { computeReturnRefund } from "@/lib/returnRefund";

/** Quanto o cliente vai receber de volta pelas peças escolhidas (mesma regra da aprovação). */
export async function POST(req: NextRequest) {
  const customer = getCustomerFromRequest(req);
  if (!customer) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { orderId, itemIds } = await req.json().catch(() => ({}));
  if (typeof orderId !== "string" || !Array.isArray(itemIds)) return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { customerId: true } });
  if (!order || order.customerId !== customer.id) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  const items = itemIds
    .filter((s: unknown): s is { itemId: string; quantity: number } => typeof (s as { itemId?: unknown })?.itemId === "string" && Number.isInteger((s as { quantity?: unknown })?.quantity))
    .map((s) => ({ itemId: s.itemId, quantity: Math.max(0, s.quantity) }));
  const split = await computeReturnRefund(orderId, items);
  return NextResponse.json({ money: split.money, credit: split.credit, listValue: split.listValue });
}
