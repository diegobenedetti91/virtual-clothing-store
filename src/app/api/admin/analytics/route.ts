import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || "0");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const statusesParam = searchParams.get("statuses") || "DELIVERED";
  const stateFilter = searchParams.get("state") || "";

  const activeStatuses = statusesParam.split(",").map((s) => s.trim()).filter(Boolean);

  const dateWhere: Record<string, unknown> = {};
  if (dateFrom) dateWhere.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    dateWhere.lte = end;
  }

  const [orders, cancelledOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: activeStatuses },
        ...(Object.keys(dateWhere).length > 0 ? { createdAt: dateWhere } : {}),
      },
      include: { items: { include: { product: { include: { category: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      where: {
        status: "CANCELLED",
        ...(Object.keys(dateWhere).length > 0 ? { createdAt: dateWhere } : {}),
      },
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

  // When using date range, skip year/month filtering (already filtered in DB query)
  const filteredOrders = dateFrom || dateTo ? orders.filter((o) => {
    if (!stateFilter) return true;
    return (o.state?.trim() || "Não informado") === stateFilter;
  }) : orders.filter((o) => {
    const d = new Date(o.createdAt);
    if (d.getFullYear() !== year) return false;
    if (month > 0 && d.getMonth() + 1 !== month) return false;
    if (stateFilter && (o.state?.trim() || "Não informado") !== stateFilter) return false;
    return true;
  });

  const filteredCancelled = cancelledOrders.filter((o) => {
    if (dateFrom || dateTo) return true;
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

  // Profit margin by product
  const productMap = new Map<string, { name: string; revenue: number; cost: number; quantity: number; hasCost: boolean }>();
  for (const o of filteredOrders) {
    for (const item of o.items) {
      const key = item.productId;
      const cur = productMap.get(key) || { name: item.product.name, revenue: 0, cost: 0, quantity: 0, hasCost: item.product.costPrice != null };
      const itemRevenue = item.price * item.quantity;
      const itemCost = item.product.costPrice != null ? item.product.costPrice * item.quantity : 0;
      productMap.set(key, {
        name: item.product.name,
        revenue: cur.revenue + itemRevenue,
        cost: cur.cost + itemCost,
        quantity: cur.quantity + item.quantity,
        hasCost: cur.hasCost || item.product.costPrice != null,
      });
    }
  }
  const byProduct = Array.from(productMap.entries())
    .map(([productId, d]) => {
      const profit = d.hasCost ? d.revenue - d.cost : null;
      const margin = d.hasCost && d.revenue > 0 ? ((d.revenue - d.cost) / d.revenue) * 100 : null;
      return { productId, name: d.name, revenue: d.revenue, cost: d.hasCost ? d.cost : null, profit, margin, quantity: d.quantity };
    })
    .sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));

  // Profit margin by order
  const byOrder = filteredOrders.map((o) => {
    let orderCost = 0;
    let allHaveCost = true;
    for (const item of o.items) {
      if (item.product.costPrice != null) {
        orderCost += item.product.costPrice * item.quantity;
      } else {
        allHaveCost = false;
      }
    }
    const profit = allHaveCost ? o.total - orderCost : null;
    const margin = allHaveCost && o.total > 0 ? ((o.total - orderCost) / o.total) * 100 : null;
    return {
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      createdAt: o.createdAt,
      revenue: o.total,
      cost: allHaveCost ? orderCost : null,
      profit,
      margin,
    };
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // All-time years and states (unfiltered) for populating dropdowns
  const allOrders = await prisma.order.findMany({
    where: { status: { not: "CANCELLED" } },
    select: { createdAt: true, state: true },
  });
  const years = [...new Set(allOrders.map((o) => new Date(o.createdAt).getFullYear()))].sort((a, b) => b - a);
  if (!years.includes(year)) years.unshift(year);
  const allStates = [...new Set(allOrders.map((o) => o.state?.trim() || "Não informado"))].sort();

  return NextResponse.json({
    year, month, years, allStates, monthlyRevenue, byState, byCategory, byCancelReason,
    byProduct, byOrder,
    summary: { revenue: periodRevenue, orders: periodOrders, ticket: periodTicket, cancelled: filteredCancelled.length },
  });
}
