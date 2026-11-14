import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { getAdminAlerts } from "@/lib/adminAlerts";
import { computeProfit } from "@/lib/profit";

const PAID = ["CONFIRMED", "SHIPPED", "DELIVERED", "PRONTO_PARA_RETIRADA", "RETIRADO"];
const DAY = 24 * 60 * 60 * 1000;
// Brasil não tem horário de verão desde 2019: UTC-3 fixo
const BRT_OFFSET = 3 * 60 * 60 * 1000;
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const brt = (d: Date) => new Date(d.getTime() - BRT_OFFSET); // ler com getUTC*
/** Meia-noite de Brasília de uma data "YYYY-MM-DD" */
const startOfDayBRT = (ymd: string) => new Date(`${ymd}T00:00:00.000-03:00`);
const ymdBRT = (d: Date) => brt(d).toISOString().slice(0, 10);

type Bucket = { key: string; label: string; short: string };

function buildBuckets(start: Date, end: Date, monthly: boolean): Bucket[] {
  const out: Bucket[] = [];
  if (monthly) {
    const s = brt(start);
    let y = s.getUTCFullYear();
    let m = s.getUTCMonth();
    const e = brt(end);
    while (y < e.getUTCFullYear() || (y === e.getUTCFullYear() && m <= e.getUTCMonth())) {
      out.push({ key: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${MONTHS[m]} ${y}`, short: `${MONTHS[m]}/${String(y).slice(2)}` });
      m++;
      if (m > 11) { m = 0; y++; }
    }
    return out;
  }
  for (let t = start.getTime(); t <= end.getTime(); t += DAY) {
    const d = brt(new Date(t));
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    out.push({ key: d.toISOString().slice(0, 10), label: `${WEEKDAYS[d.getUTCDay()]}, ${dd} ${MONTHS[d.getUTCMonth()]}`, short: `${dd}/${mm}` });
  }
  return out;
}

const bucketKey = (d: Date, monthly: boolean) => (monthly ? ymdBRT(d).slice(0, 7) : ymdBRT(d));

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const today = ymdBRT(new Date());
  let start: Date;
  let end: Date;
  const from = sp.get("from");
  const to = sp.get("to");
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    start = startOfDayBRT(from);
    end = new Date(startOfDayBRT(to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : today).getTime() + DAY - 1);
  } else {
    const days = Math.min(Math.max(parseInt(sp.get("days") || "30") || 30, 1), 730);
    end = new Date(startOfDayBRT(today).getTime() + DAY - 1);
    start = new Date(startOfDayBRT(today).getTime() - (days - 1) * DAY);
  }
  const length = end.getTime() - start.getTime() + 1;
  const prevStart = new Date(start.getTime() - length);
  const prevEnd = new Date(start.getTime() - 1);
  const monthly = length > 92 * DAY;

  const [orders, sessionsCur, sessionsPrev, customersCur, customersPrev, funnelEvents, alertData] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: prevStart, lte: end } },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        subtotal: true,
        shippingCost: true,
        couponDiscount: true,
        shippingLabelCost: true,
        total: true,
        paymentFee: true,
        status: true,
        createdAt: true,
        paymentMethod: true,
        paymentGateway: true,
        state: true,
        trafficChannel: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            price: true,
            product: { select: { name: true, costPrice: true, category: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.analyticsEvent.count({ where: { type: "SESSION_START", createdAt: { gte: start, lte: end } } }),
    prisma.analyticsEvent.count({ where: { type: "SESSION_START", createdAt: { gte: prevStart, lte: prevEnd } } }),
    prisma.customerUser.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.customerUser.count({ where: { createdAt: { gte: prevStart, lte: prevEnd } } }),
    prisma.analyticsEvent.findMany({
      where: { type: { in: ["SESSION_START", "PRODUCT_VIEW", "ADD_TO_CART", "CHECKOUT_START"] }, createdAt: { gte: start, lte: end }, sessionId: { not: null } },
      distinct: ["type", "sessionId"],
      select: { type: true },
    }),
    getAdminAlerts(),
  ]);

  // Meta do mês corrente (horário de Brasília) e estornos para o lucro real
  const nowBrt = new Date(Date.now() - BRT_OFFSET);
  const monthStart = new Date(Date.UTC(nowBrt.getUTCFullYear(), nowBrt.getUTCMonth(), 1) + BRT_OFFSET);
  const daysInMonth = new Date(Date.UTC(nowBrt.getUTCFullYear(), nowBrt.getUTCMonth() + 1, 0)).getUTCDate();
  const [goalSettings, monthRevenueAgg, approvedReturns] = await Promise.all([
    prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { monthlyRevenueGoal: true } }),
    prisma.order.aggregate({ where: { status: { in: PAID }, createdAt: { gte: monthStart } }, _sum: { total: true } }),
    prisma.return.findMany({
      where: { status: "APPROVED", orderId: { in: orders.filter((o) => PAID.includes(o.status)).map((o) => o.id) } },
      select: { orderId: true, refundAmount: true },
    }),
  ]);
  const refundsByOrder = new Map<string, number>();
  for (const r of approvedReturns) refundsByOrder.set(r.orderId, (refundsByOrder.get(r.orderId) || 0) + (r.refundAmount || 0));

  const cur = orders.filter((o) => o.createdAt >= start);
  const prev = orders.filter((o) => o.createdAt < start);
  const paidCur = cur.filter((o) => PAID.includes(o.status));
  const paidPrev = prev.filter((o) => PAID.includes(o.status));

  const sum = (list: typeof orders, f: (o: (typeof orders)[number]) => number) => list.reduce((s, o) => s + f(o), 0);
  const itemsOf = (o: (typeof orders)[number]) => o.items.reduce((s, i) => s + i.quantity, 0);
  const costOf = (o: (typeof orders)[number]) => o.items.reduce((s, i) => s + (i.product.costPrice ?? 0) * i.quantity, 0);

  // ─── Séries por bucket ───
  const buckets = buildBuckets(start, end, monthly);
  const prevBuckets = buildBuckets(prevStart, prevEnd, monthly);
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  const prevIdx = new Map(prevBuckets.map((b, i) => [b.key, i]));
  const zero = () => buckets.map(() => 0);
  const series = { revenue: zero(), orders: zero(), items: zero(), ticket: zero(), prevRevenue: zero(), cancelled: zero() };
  for (const o of paidCur) {
    const i = idx.get(bucketKey(o.createdAt, monthly));
    if (i == null) continue;
    series.revenue[i] += o.total;
    series.orders[i] += 1;
    series.items[i] += itemsOf(o);
  }
  for (const o of cur) {
    if (o.status !== "CANCELLED") continue;
    const i = idx.get(bucketKey(o.createdAt, monthly));
    if (i != null) series.cancelled[i] += 1;
  }
  for (const o of paidPrev) {
    const i = prevIdx.get(bucketKey(o.createdAt, monthly));
    if (i != null && i < buckets.length) series.prevRevenue[i] += o.total;
  }
  series.ticket = series.revenue.map((r, i) => (series.orders[i] ? r / series.orders[i] : 0));

  // ─── KPIs ───
  const revenue = sum(paidCur, (o) => o.total);
  const revenuePrev = sum(paidPrev, (o) => o.total);
  const fees = sum(paidCur, (o) => o.paymentFee || 0);
  const feesPrev = sum(paidPrev, (o) => o.paymentFee || 0);
  // Frete vai para a transportadora: custo real da etiqueta ou, sem ele, o frete cobrado
  const shippingOf = (o: { shippingLabelCost: number | null; shippingCost: number }) => o.shippingLabelCost ?? o.shippingCost ?? 0;
  const shipping = sum(paidCur, shippingOf);
  const shippingPrev = sum(paidPrev, shippingOf);
  const kpis = {
    revenue: { cur: revenue, prev: revenuePrev },
    netRevenue: { cur: revenue - fees - shipping, prev: revenuePrev - feesPrev - shippingPrev },
    orders: { cur: paidCur.length, prev: paidPrev.length },
    ticket: { cur: paidCur.length ? revenue / paidCur.length : 0, prev: paidPrev.length ? revenuePrev / paidPrev.length : 0 },
    items: { cur: sum(paidCur, itemsOf), prev: sum(paidPrev, itemsOf) },
    sessions: { cur: sessionsCur, prev: sessionsPrev },
    conversion: { cur: sessionsCur ? (paidCur.length / sessionsCur) * 100 : 0, prev: sessionsPrev ? (paidPrev.length / sessionsPrev) * 100 : 0 },
    newCustomers: { cur: customersCur, prev: customersPrev },
    cancelRate: {
      cur: cur.length ? (cur.filter((o) => o.status === "CANCELLED").length / cur.length) * 100 : 0,
      prev: prev.length ? (prev.filter((o) => o.status === "CANCELLED").length / prev.length) * 100 : 0,
    },
    grossProfit: { cur: revenue - shipping - sum(paidCur, costOf), prev: revenuePrev - shippingPrev - sum(paidPrev, costOf) },
  };

  // Lucro líquido (DRE simplificado: descontos, taxas, custo, frete das etiquetas, estornos)
  const profitCur = computeProfit(paidCur, refundsByOrder).totals;
  const profitPrev = computeProfit(paidPrev, refundsByOrder).totals;

  const goalValue = goalSettings?.monthlyRevenueGoal ?? null;
  const monthRevenue = monthRevenueAgg._sum.total || 0;
  const dayOfMonth = nowBrt.getUTCDate();
  const projected = (monthRevenue / dayOfMonth) * daysInMonth;
  const goal = {
    target: goalValue,
    revenue: monthRevenue,
    projected,
    dayOfMonth,
    daysInMonth,
    remaining: goalValue != null ? Math.max(0, goalValue - monthRevenue) : null,
    // Quanto precisa vender por dia (incluindo hoje) para bater a meta
    perDayNeeded: goalValue != null ? Math.max(0, goalValue - monthRevenue) / Math.max(1, daysInMonth - dayOfMonth + 1) : null,
  };

  // ─── Dimensões ───
  const group = <T,>(list: T[], key: (x: T) => string, val: (x: T) => number) => {
    const m = new Map<string, { value: number; count: number }>();
    for (const x of list) {
      const k = key(x);
      const c = m.get(k) || { value: 0, count: 0 };
      c.value += val(x);
      c.count += 1;
      m.set(k, c);
    }
    return [...m.entries()].map(([label, d]) => ({ label, ...d })).sort((a, b) => b.value - a.value);
  };

  const STATUS_LABEL: Record<string, string> = {
    PENDING: "Aguardando pagamento",
    CONFIRMED: "Confirmado",
    SHIPPED: "Enviado",
    PRONTO_PARA_RETIRADA: "Pronto p/ retirada",
    RETIRADO: "Retirado",
    DELIVERED: "Entregue",
    CANCELLED: "Cancelado",
  };

  const byStatus = group(cur, (o) => STATUS_LABEL[o.status] || o.status, () => 1);
  const byPayment = group(paidCur, (o) => o.paymentMethod || o.paymentGateway || "Não informado", (o) => o.total);
  const byState = group(paidCur, (o) => o.state?.trim().toUpperCase() || "Não informado", (o) => o.total);
  const byChannel = group(paidCur, (o) => o.trafficChannel || "Não identificado", (o) => o.total);

  const productMap = new Map<string, { label: string; value: number; qty: number }>();
  const categoryMap = new Map<string, { label: string; value: number; qty: number }>();
  for (const o of paidCur) {
    for (const it of o.items) {
      const v = it.price * it.quantity;
      const p = productMap.get(it.productId) || { label: it.product.name, value: 0, qty: 0 };
      p.value += v;
      p.qty += it.quantity;
      productMap.set(it.productId, p);
      const cname = it.product.category?.name || "Sem categoria";
      const c = categoryMap.get(cname) || { label: cname, value: 0, qty: 0 };
      c.value += v;
      c.qty += it.quantity;
      categoryMap.set(cname, c);
    }
  }
  const topProducts = [...productMap.values()].sort((a, b) => b.value - a.value).slice(0, 10);
  const byCategory = [...categoryMap.values()].sort((a, b) => b.value - a.value);

  // Dia da semana × hora (horário de Brasília)
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const o of paidCur) {
    const d = brt(o.createdAt);
    heatmap[d.getUTCDay()][d.getUTCHours()] += 1;
  }

  const funnelCount = (t: string) => funnelEvents.filter((e) => e.type === t).length;
  const funnel = [
    { label: "Visitas", value: funnelCount("SESSION_START") },
    { label: "Viram um produto", value: funnelCount("PRODUCT_VIEW") },
    { label: "Adicionaram ao carrinho", value: funnelCount("ADD_TO_CART") },
    { label: "Iniciaram o checkout", value: funnelCount("CHECKOUT_START") },
    { label: "Compraram", value: paidCur.length },
  ];

  return NextResponse.json({
    period: { start: start.toISOString(), end: end.toISOString(), monthly },
    profit: {
      cur: profitCur,
      prev: { net: profitPrev.net, margin: profitPrev.margin, gross: profitPrev.gross },
    },
    goal,
    buckets: buckets.map((b, i) => ({
      label: b.label,
      short: b.short,
      revenue: series.revenue[i],
      prevRevenue: series.prevRevenue[i],
      orders: series.orders[i],
      items: series.items[i],
      ticket: series.ticket[i],
      cancelled: series.cancelled[i],
    })),
    kpis,
    byStatus,
    byPayment,
    byState,
    byChannel,
    byCategory,
    topProducts,
    heatmap,
    funnel,
    alerts: alertData.alerts,
  });
}
