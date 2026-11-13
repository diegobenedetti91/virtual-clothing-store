import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromCookie } from "@/lib/customerAuth";
import { CUSTOMER_ORDER_SELECT, customerActions, maskDocument } from "@/lib/customerOrder";

/** Detalhe do pedido para o próprio cliente (somente campos seguros). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getCustomerFromCookie();
  if (!payload) return NextResponse.json({ error: "Faça login para ver o pedido" }, { status: 401 });

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      ...CUSTOMER_ORDER_SELECT,
      trackingEvents: { orderBy: { timestamp: "desc" }, take: 4, select: { status: true, location: true, timestamp: true } },
    },
  });

  const owns =
    !!order &&
    (order.customerId === payload.id || (!!order.customerEmail && order.customerEmail.toLowerCase() === payload.email.toLowerCase()));
  if (!order || !owns) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  const { customerId: _cid, cpfCnpj, ...rest } = order;
  return NextResponse.json({ ...rest, cpfCnpj: maskDocument(cpfCnpj), ...customerActions(order) });
}
