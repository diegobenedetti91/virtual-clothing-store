import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromCookie } from "@/lib/customerAuth";

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
    include: { items: { include: { product: true } } },
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

  return NextResponse.json(orders);
}
