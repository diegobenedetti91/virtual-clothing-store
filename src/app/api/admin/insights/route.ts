import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { computeProfit, getTaxRate, PAID_STATUSES, PROFIT_ORDER_SELECT } from "@/lib/profit";

const DAY = 86400000;
const BRT = 3 * 3600000; // Brasil sem horário de verão: UTC−3 fixo
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const r2 = (n: number) => Math.round(n * 100) / 100;
const brtKey = (d: Date) => new Date(d.getTime() - BRT).toISOString().slice(0, 7); // YYYY-MM

function parseRange(sp: URLSearchParams) {
  const today = new Date(Date.now() - BRT).toISOString().slice(0, 10);
  const valid = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const to = valid(sp.get("to")) ? sp.get("to")! : today;
  let from: string;
  if (valid(sp.get("from"))) from = sp.get("from")!;
  else {
    const days = Math.min(Math.max(parseInt(sp.get("days") || "90") || 90, 1), 1095);
    from = new Date(new Date(`${to}T00:00:00-03:00`).getTime() - (days - 1) * DAY - BRT).toISOString().slice(0, 10);
  }
  return { start: new Date(`${from}T00:00:00-03:00`), end: new Date(`${to}T23:59:59.999-03:00`), from, to };
}

/** Tamanho/cor de um item (campos antigos ou atributos da variação). */
function variantOf(it: { size: string | null; color: string | null; selectedAttributes: string | null }) {
  let size = it.size || null;
  let color = it.color || null;
  if (it.selectedAttributes) {
    try {
      const a = JSON.parse(it.selectedAttributes) as Record<string, string>;
      for (const [k, v] of Object.entries(a)) {
        const key = k.toLowerCase();
        if (!size && (key === "tamanho" || key === "size")) size = v;
        if (!color && (key === "cor" || key === "cores" || key === "color")) color = v;
      }
    } catch {}
  }
  return { size, color };
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { start, end, from, to } = parseRange(req.nextUrl.searchParams);
  const inPeriod = { gte: start, lte: end };
  const sixtyDaysAgo = new Date(Date.now() - 60 * DAY);

  const [paidOrders, variantItems, cancelled, pendingOld, returns, abandoned, waitlist, activeProducts, soldRecently, customerOrders] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: PAID_STATUSES }, createdAt: inPeriod },
      select: { ...PROFIT_ORDER_SELECT, couponCode: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.orderItem.findMany({
      where: { order: { status: { in: PAID_STATUSES }, createdAt: inPeriod } },
      select: { id: true, productId: true, quantity: true, price: true, size: true, color: true, selectedAttributes: true, product: { select: { name: true, costPrice: true } } },
    }),
    prisma.order.findMany({ where: { status: "CANCELLED", createdAt: inPeriod }, select: { total: true, cancelReason: true } }),
    prisma.order.findMany({
      where: { status: "PENDING", createdAt: { gte: start, lte: new Date(Math.min(end.getTime(), Date.now() - DAY)) } },
      select: { total: true, paymentMethod: true },
    }),
    prisma.return.findMany({
      where: { createdAt: inPeriod },
      select: { reason: true, status: true, refundAmount: true, returnedItems: true, orderId: true },
    }),
    prisma.abandonedCart.findMany({ select: { email: true, cartItems: true, updatedAt: true } }),
    prisma.waitlistEntry.findMany({
      where: { notified: false },
      select: { productId: true, size: true, color: true, product: { select: { name: true, price: true, stock: true } } },
    }),
    prisma.product.findMany({
      where: { active: true, stock: { gt: 0 }, createdAt: { lt: sixtyDaysAgo } },
      select: { id: true, name: true, stock: true, price: true, costPrice: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { status: { in: PAID_STATUSES }, createdAt: { gte: sixtyDaysAgo } } },
      select: { productId: true },
      distinct: ["productId"],
    }),
    // Clientes: histórico completo (recorrência não cabe num período curto)
    prisma.order.findMany({
      where: { status: { in: PAID_STATUSES } },
      select: { customerId: true, customerEmail: true, total: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // ─── 1. Lucro real ───
  const refundsByOrder = new Map<string, number>();
  for (const r of returns) if (r.status === "APPROVED") refundsByOrder.set(r.orderId, (refundsByOrder.get(r.orderId) || 0) + (r.refundAmount || 0));
  const profit = computeProfit(paidOrders, refundsByOrder, await getTaxRate());
  const monthMap = new Map<string, { gross: number; net: number }>();
  for (const row of profit.rows) {
    const k = brtKey(new Date(row.createdAt));
    const m = monthMap.get(k) || { gross: 0, net: 0 };
    m.gross += row.gross;
    m.net += row.net;
    monthMap.set(k, m);
  }
  const monthly = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({ label: `${MONTHS[Number(k.slice(5, 7)) - 1]}/${k.slice(2, 4)}`, gross: r2(v.gross), net: r2(v.net), margin: v.gross > 0 ? (v.net / v.gross) * 100 : null }));

  // ─── 2. Perdas ───
  const paidEmails = new Map<string, Date[]>();
  for (const o of customerOrders) {
    if (!o.customerEmail) continue;
    const e = o.customerEmail.toLowerCase();
    if (!paidEmails.has(e)) paidEmails.set(e, []);
    paidEmails.get(e)!.push(o.createdAt);
  }
  let abandonedValue = 0;
  let abandonedCount = 0;
  let recovered = 0;
  let recoveredValue = 0;
  for (const c of abandoned) {
    let value = 0;
    try {
      const items = JSON.parse(c.cartItems) as { price?: number; quantity?: number }[];
      value = Array.isArray(items) ? items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0) : 0;
    } catch {}
    if (value <= 0) continue;
    // Recuperado: o mesmo e-mail fez um pedido pago depois do carrinho
    const later = (paidEmails.get(c.email.toLowerCase()) || []).some((d) => d > c.updatedAt);
    if (later) { recovered++; recoveredValue += value; }
    else { abandonedCount++; abandonedValue += value; }
  }

  const group = <T,>(list: T[], key: (x: T) => string, val: (x: T) => number) => {
    const m = new Map<string, { count: number; value: number }>();
    for (const x of list) {
      const k = key(x);
      const c = m.get(k) || { count: 0, value: 0 };
      c.count++;
      c.value += val(x);
      m.set(k, c);
    }
    return [...m.entries()].map(([label, d]) => ({ label, count: d.count, value: r2(d.value) })).sort((a, b) => b.value - a.value);
  };

  const unpaidByReason = cancelled.filter((o) => /pagamento|pago|expir|recusad|pix/i.test(o.cancelReason || ""));
  const cancellations = group(cancelled, (o) => o.cancelReason?.trim() || "Sem motivo informado", (o) => o.total);

  // Itens devolvidos por produto
  const itemProduct = new Map(variantItems.map((i) => [i.id, i.productId]));
  const extraItemIds = new Set<string>();
  for (const r of returns) for (const ri of (Array.isArray(r.returnedItems) ? r.returnedItems : []) as { itemId?: string }[]) if (ri?.itemId && !itemProduct.has(ri.itemId)) extraItemIds.add(ri.itemId);
  if (extraItemIds.size) {
    const extra = await prisma.orderItem.findMany({ where: { id: { in: [...extraItemIds] } }, select: { id: true, productId: true } });
    for (const e of extra) itemProduct.set(e.id, e.productId);
  }
  const productName = new Map(variantItems.map((i) => [i.productId, i.product.name]));
  const soldByProduct = new Map<string, number>();
  for (const i of variantItems) soldByProduct.set(i.productId, (soldByProduct.get(i.productId) || 0) + i.quantity);
  const returnedByProduct = new Map<string, number>();
  for (const r of returns) {
    if (r.status === "REJECTED") continue;
    for (const ri of (Array.isArray(r.returnedItems) ? r.returnedItems : []) as { itemId?: string; quantity?: number }[]) {
      const pid = ri?.itemId ? itemProduct.get(ri.itemId) : undefined;
      if (pid) returnedByProduct.set(pid, (returnedByProduct.get(pid) || 0) + (Number(ri.quantity) || 1));
    }
  }
  const returnRateByProduct = [...returnedByProduct.entries()]
    .map(([pid, returned]) => {
      const sold = soldByProduct.get(pid) || 0;
      return { productId: pid, name: productName.get(pid) || "Produto", sold, returned, rate: sold > 0 ? (returned / sold) * 100 : null };
    })
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || b.returned - a.returned)
    .slice(0, 20);
  const unitsSold = variantItems.reduce((s, i) => s + i.quantity, 0);
  const unitsReturned = [...returnedByProduct.values()].reduce((s, n) => s + n, 0);

  const waitMap = new Map<string, { productId: string; name: string; variant: string; people: number; value: number; stock: number }>();
  for (const w of waitlist) {
    const variant = [w.size, w.color].filter(Boolean).join(" / ") || "—";
    const k = `${w.productId}|${variant}`;
    const cur = waitMap.get(k) || { productId: w.productId, name: w.product.name, variant, people: 0, value: 0, stock: w.product.stock };
    cur.people++;
    cur.value += w.product.price;
    waitMap.set(k, cur);
  }
  const waitlistDemand = [...waitMap.values()].map((w) => ({ ...w, value: r2(w.value) })).sort((a, b) => b.value - a.value);

  const recentlySold = new Set(soldRecently.map((s) => s.productId));
  const deadStock = activeProducts
    .filter((p) => !recentlySold.has(p.id))
    .map((p) => ({
      productId: p.id,
      name: p.name,
      stock: p.stock,
      unitCost: p.costPrice ?? p.price,
      costKnown: p.costPrice != null,
      capital: r2(p.stock * (p.costPrice ?? p.price)),
    }))
    .sort((a, b) => b.capital - a.capital);

  // ─── 3. Produtos e clientes ───
  const prodAgg = new Map<string, { name: string; qty: number; revenue: number; profit: number; costKnown: boolean }>();
  for (const i of variantItems) {
    const cur = prodAgg.get(i.productId) || { name: i.product.name, qty: 0, revenue: 0, profit: 0, costKnown: true };
    const rev = i.price * i.quantity;
    cur.qty += i.quantity;
    cur.revenue += rev;
    if (i.product.costPrice != null) cur.profit += rev - i.product.costPrice * i.quantity;
    else { cur.profit += rev; cur.costKnown = false; } // sem custo: usa a receita (indicado na tela)
    prodAgg.set(i.productId, cur);
  }
  const abcBase = [...prodAgg.entries()].map(([productId, d]) => ({ productId, ...d })).sort((a, b) => b.profit - a.profit);
  const abcTotal = abcBase.reduce((s, p) => s + Math.max(0, p.profit), 0);
  let cum = 0;
  const abc = abcBase.map((p) => {
    const share = abcTotal > 0 ? (Math.max(0, p.profit) / abcTotal) * 100 : 0;
    const before = cum;
    cum += share;
    return { ...p, revenue: r2(p.revenue), profit: r2(p.profit), share, cumShare: cum, class: before < 80 ? "A" : before < 95 ? "B" : "C" };
  });

  const sizeMap = new Map<string, number>();
  const colorMap = new Map<string, number>();
  for (const i of variantItems) {
    const v = variantOf(i);
    if (v.size) sizeMap.set(v.size, (sizeMap.get(v.size) || 0) + i.quantity);
    if (v.color) colorMap.set(v.color, (colorMap.get(v.color) || 0) + i.quantity);
  }
  const toList = (m: Map<string, number>) => [...m.entries()].map(([label, qty]) => ({ label, qty })).sort((a, b) => b.qty - a.qty);

  const byCustomer = new Map<string, { dates: Date[]; total: number }>();
  for (const o of customerOrders) {
    const k = o.customerId || o.customerEmail?.toLowerCase();
    if (!k) continue;
    const c = byCustomer.get(k) || { dates: [], total: 0 };
    c.dates.push(o.createdAt);
    c.total += o.total;
    byCustomer.set(k, c);
  }
  const buyers = byCustomer.size;
  const recurringList = [...byCustomer.values()].filter((c) => c.dates.length >= 2);
  const gaps: number[] = [];
  for (const c of recurringList) for (let i = 1; i < c.dates.length; i++) gaps.push((c.dates[i].getTime() - c.dates[i - 1].getTime()) / DAY);
  const lifetime = [...byCustomer.values()].reduce((s, c) => s + c.total, 0);

  const couponMap = new Map<string, { uses: number; discount: number; revenue: number }>();
  for (const o of paidOrders) {
    if (!o.couponCode) continue;
    const c = couponMap.get(o.couponCode) || { uses: 0, discount: 0, revenue: 0 };
    c.uses++;
    c.discount += o.couponDiscount || 0;
    c.revenue += o.total;
    couponMap.set(o.couponCode, c);
  }
  const coupons = [...couponMap.entries()]
    .map(([code, c]) => ({ code, uses: c.uses, discount: r2(c.discount), revenue: r2(c.revenue), roi: c.discount > 0 ? c.revenue / c.discount : null }))
    .sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json({
    period: { from, to },
    profit: { totals: profit.totals, monthly, rows: profit.rows.slice(0, 3000) },
    losses: {
      abandoned: { count: abandonedCount, value: r2(abandonedValue), recovered, recoveredValue: r2(recoveredValue) },
      unpaid: { pendingCount: pendingOld.length, pendingValue: r2(pendingOld.reduce((s, o) => s + o.total, 0)), cancelledCount: unpaidByReason.length, cancelledValue: r2(unpaidByReason.reduce((s, o) => s + o.total, 0)) },
      cancellations,
      returnsByReason: group(returns, (r) => r.reason?.trim().slice(0, 80) || "Sem motivo", (r) => (r.status === "APPROVED" ? r.refundAmount || 0 : 0)),
      returnRate: { unitsSold, unitsReturned, rate: unitsSold > 0 ? (unitsReturned / unitsSold) * 100 : null, byProduct: returnRateByProduct },
      waitlist: { people: waitlist.length, value: r2(waitlistDemand.reduce((s, w) => s + w.value, 0)), items: waitlistDemand.slice(0, 30) },
      deadStock: { count: deadStock.length, units: deadStock.reduce((s, p) => s + p.stock, 0), capital: r2(deadStock.reduce((s, p) => s + p.capital, 0)), items: deadStock.slice(0, 50) },
    },
    growth: {
      abc,
      sizes: toList(sizeMap),
      colors: toList(colorMap),
      customers: {
        buyers,
        recurring: recurringList.length,
        recurrenceRate: buyers > 0 ? (recurringList.length / buyers) * 100 : null,
        avgDaysBetween: gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null,
        avgValue: buyers > 0 ? r2(lifetime / buyers) : 0,
        avgOrders: buyers > 0 ? customerOrders.length / buyers : 0,
      },
      coupons,
    },
  });
}
