import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromCookie } from "@/lib/customerAuth";
import { CUSTOMER_ORDER_SELECT, customerActions } from "@/lib/customerOrder";

export async function GET() {
  const payload = await getCustomerFromCookie();
  if (!payload) return NextResponse.json([]);

  // Busca pedidos pelo customerId OU pelo e-mail do cliente
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { customerId: payload.id },
        { customerEmail: payload.email },
      ],
    },
    select: CUSTOMER_ORDER_SELECT,
    orderBy: { createdAt: "desc" },
  });

  // Vincula automaticamente pedidos pelo e-mail que ainda não têm customerId
  const unlinked = orders.filter((o) => !o.customerId && o.customerEmail === payload.email);
  if (unlinked.length > 0) {
    await prisma.order.updateMany({
      where: { id: { in: unlinked.map((o) => o.id) } },
      data: { customerId: payload.id },
    });
  }

  // Só campos que o cliente pode ver (sem IDs internos, IP, taxas etc.)
  return NextResponse.json(orders.map(({ customerId: _c, cpfCnpj: _d, ...o }) => ({ ...o, ...customerActions(o) })));
}
