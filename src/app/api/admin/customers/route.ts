import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customers = await prisma.customerUser.findMany({
    include: {
      orders: { select: { total: true, createdAt: true, status: true } },
      _count: { select: { wishlist: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = customers.map((c) => {
    const delivered = c.orders.filter((o) => o.status === "DELIVERED");
    const cancelled = c.orders.filter((o) => o.status === "CANCELLED");
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      city: c.city,
      state: c.state,
      createdAt: c.createdAt,
      orderCount: delivered.length,
      cancelledCount: cancelled.length,
      wishlistCount: c._count.wishlist,
      totalSpent: delivered.reduce((s, o) => s + o.total, 0),
      lastOrderAt: delivered.at(-1)?.createdAt || null,
    };
  });

  return NextResponse.json(data);
}
