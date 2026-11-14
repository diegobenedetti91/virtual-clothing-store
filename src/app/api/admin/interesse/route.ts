import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

const PAID = ["CONFIRMED", "SHIPPED", "PRONTO_PARA_RETIRADA", "DELIVERED", "RETIRADO"];
const DAY = 86_400_000;

/**
 * Interesse por produto no período: visualizações, pessoas, carrinho, vendas e conversão,
 * com selos ("muito visto, pouco vendido"…) e o histórico dos avisos enviados.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("dias")) || 30));
  const since = new Date(Date.now() - days * DAY);
  const interestSince = new Date(Date.now() - 60 * DAY);

  const [eventCounts, viewers, interested, sold, buyers, campaigns] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["productId", "type"],
      where: { productId: { not: null }, type: { in: ["PRODUCT_VIEW", "ADD_TO_CART"] }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { productId: { not: null }, type: "PRODUCT_VIEW", createdAt: { gte: since }, sessionId: { not: null } },
      distinct: ["productId", "sessionId"],
      select: { productId: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { productId: { not: null }, type: { in: ["PRODUCT_VIEW", "ADD_TO_CART"] }, customerId: { not: null }, createdAt: { gte: interestSince } },
      distinct: ["productId", "customerId"],
      select: { productId: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { status: { in: PAID }, createdAt: { gte: since } } },
      _sum: { quantity: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { status: { in: PAID }, createdAt: { gte: since } } },
      distinct: ["productId", "orderId"],
      select: { productId: true },
    }),
    prisma.promoCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { product: { select: { name: true } }, emails: { select: { customerId: true, clickedAt: true } } },
    }),
  ]);

  const tally = <T extends { productId: string | null }>(rows: T[]) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.productId) m.set(r.productId, (m.get(r.productId) || 0) + 1);
    return m;
  };
  const views = new Map<string, number>();
  const carts = new Map<string, number>();
  for (const e of eventCounts) {
    if (!e.productId) continue;
    (e.type === "PRODUCT_VIEW" ? views : carts).set(e.productId, e._count._all);
  }
  const people = tally(viewers);
  const interestedBy = tally(interested);
  const orders = tally(buyers);
  const units = new Map(sold.map((s) => [s.productId, s._sum.quantity || 0]));

  const ids = [...new Set([...views.keys(), ...carts.keys(), ...units.keys()])];
  const now = new Date();
  const [products, sales] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, slug: true, price: true, comparePrice: true, stock: true, active: true, images: true },
    }),
    prisma.flashSale.findMany({ where: { productId: { in: ids }, active: true, startAt: { lte: now }, endAt: { gte: now } }, select: { productId: true } }),
  ]);
  const onSale = new Set(sales.map((s) => s.productId));
  const viewList = [...views.values()].sort((a, b) => a - b);
  const median = viewList.length ? viewList[Math.floor(viewList.length / 2)] : 0;

  const rows = products.map((p) => {
    const v = views.get(p.id) || 0;
    const ppl = people.get(p.id) || 0;
    const o = orders.get(p.id) || 0;
    const conversion = ppl ? (o / ppl) * 100 : null;
    let image: string | null = null;
    try { image = (JSON.parse(p.images || "[]") as string[])[0] ?? null; } catch {}
    const tag =
      v >= Math.max(10, median * 2) && (conversion == null || conversion < 3) ? "hot_no_sale"
      : o >= 2 && conversion != null && conversion >= 10 ? "champion"
      : v <= Math.max(2, median / 3) && o === 0 ? "low_interest"
      : null;
    return {
      id: p.id, name: p.name, slug: p.slug, image, price: p.price, comparePrice: p.comparePrice, stock: p.stock, active: p.active,
      onFlashSale: onSale.has(p.id),
      views: v, people: ppl, cartAdds: carts.get(p.id) || 0, unitsSold: units.get(p.id) || 0, orders: o,
      conversion, interested: interestedBy.get(p.id) || 0, tag,
    };
  }).sort((a, b) => b.views - a.views || b.unitsSold - a.unitsSold).slice(0, 150);

  // Resultado dos avisos: cliques e compras do produto pelos destinatários em até 14 dias
  const history = await Promise.all(campaigns.map(async (c) => {
    const recipients = c.emails.map((e) => e.customerId);
    const purchases = recipients.length
      ? await prisma.order.count({
          where: {
            customerId: { in: recipients }, status: { in: PAID },
            createdAt: { gte: c.createdAt, lte: new Date(c.createdAt.getTime() + 14 * DAY) },
            items: { some: { productId: c.productId } },
          },
        })
      : 0;
    return {
      id: c.id, productName: c.product.name, reason: c.reason, trigger: c.trigger, couponCode: c.couponCode,
      createdAt: c.createdAt.toISOString(), sent: c.sent, skipped: c.skipped,
      clicks: c.emails.filter((e) => e.clickedAt).length, purchases,
    };
  }));

  return NextResponse.json({ days, rows, history }, { headers: { "Cache-Control": "no-store" } });
}
