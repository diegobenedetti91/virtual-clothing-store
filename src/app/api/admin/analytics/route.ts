import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || "0");

  const [orders, cancelledOrders] = await Promise.all([
    prisma.order.findMany({
      where: { status: { not: "CANCELLED" } },
      include: { items: { include: { product: { include: { category: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      where: { status: "CANCELLED" },
      select: { cancelReason: true, createdAt: true, total: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  const monthlyRevenue = MONTHS.map((label, m) => {
    const monthOrders = orders.filter((o) => {
      const d = new Date(o.createdAt);
      return d.getFullYear() === year && d.getMonth() === m;
    });
    return { month: m + 1, label, revenue: monthOrders.reduce((s, o) => s + o.total, 0), orders: monthOrders.length };
  });

  const filteredOrders = orders.filter((o) => {
    const d = new Date(o.createdAt);
    if (d.getFullYear() !== year) return false;
    if (month > 0 && d.getMonth() + 1 !== month) return false;
    return true;
  });

  const stateMap = new Map<string, { revenue: number; orders: number }>();
  for (const o of filteredOrders) {
    const key = o.state?.trim() || "Não informado";
    const cur = stateMap.get(key) || { revenue: 0, orders: 0 };
    stateMap.set(key, { revenue: cur.revenue + o.total, orders: cur.orders + 1 });
  }
  const byState = Array.from(stateMap.entries())
    .map(([state, data]) => ({ state, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  const catMap = new Map<string, { revenue: number; items: number }>();
  for (const o of filteredOrders) {
    for (const item of o.items) {
      const key = item.product.category?.name || "Sem categoria";
      const cur = catMap.get(key) || { revenue: 0, items: 0 };
      catMap.set(key, { revenue: cur.revenue + item.price * item.quantity, items: cur.items + item.quantity });
    }
  }
  const byCategory = Array.from(catMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  // Cancellations by reason for selected period
  const filteredCancelled = cancelledOrders.filter((o) => {
    const d = new Date(o.createdAt);
    if (d.getFullYear() !== year) return false;
    if (month > 0 && d.getMonth() + 1 !== month) return false;
    return true;
  });
  const reasonMap = new Map<string, { count: number; total: number }>();
  for (const o of filteredCancelled) {
    const key = o.cancelReason?.trim() || "Sem motivo informado";
    const cur = reasonMap.get(key) || { count: 0, total: 0 };
    reasonMap.set(key, { count: cur.count + 1, total: cur.total + o.total });
  }
  const byCancelReason = Array.from(reasonMap.entries())
    .map(([reason, data]) => ({ reason, ...data }))
    .sort((a, b) => b.count - a.count);

  const periodRevenue = filteredOrders.reduce((s, o) => s + o.total, 0);
  const periodOrders = filteredOrders.length;
  const periodTicket = periodOrders > 0 ? periodRevenue / periodOrders : 0;

  const years = [...new Set([...orders, ...cancelledOrders].map((o) => new Date(o.createdAt).getFullYear()))].sort((a, b) => b - a);
  if (!years.includes(year)) years.unshift(year);

  return NextResponse.json({
    year, month, years, monthlyRevenue, byState, byCategory, byCancelReason,
    summary: { revenue: periodRevenue, orders: periodOrders, ticket: periodTicket, cancelled: filteredCancelled.length },
  });
}
