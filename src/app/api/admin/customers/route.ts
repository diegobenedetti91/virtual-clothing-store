import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customers = await prisma.customerUser.findMany({
    include: {
      orders: { where: { status: { not: "CANCELLED" } }, select: { total: true, createdAt: true } },
      _count: { select: { orders: true, wishlist: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = customers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    city: c.city,
    state: c.state,
    createdAt: c.createdAt,
    orderCount: c._count.orders,
    wishlistCount: c._count.wishlist,
    totalSpent: c.orders.reduce((s, o) => s + o.total, 0),
    lastOrderAt: c.orders.at(0)?.createdAt || null,
  }));

  return NextResponse.json(data);
}
