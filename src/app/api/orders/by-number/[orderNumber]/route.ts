import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCustomerFromRequest } from "@/lib/customerAuth";

// Single order lookup for the checkout success page. Order numbers are short and
// guessable, so only the customer who placed the order (or an admin) can read it.
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      customerId: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      notes: true,
      total: true,
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          price: true,
          size: true,
          color: true,
          product: { select: { name: true } },
        },
      },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { customerId, ...publicOrder } = order;
  const customer = getCustomerFromRequest(req);
  const isOwner =
    !!customer &&
    (customerId === customer.id ||
      (!!order.customerEmail && order.customerEmail.toLowerCase() === customer.email.toLowerCase()));
  if (!isOwner && !(await auth())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(publicOrder);
}
