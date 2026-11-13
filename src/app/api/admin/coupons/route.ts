import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { PAID_STATUSES } from "@/lib/coupons";
import { parseCouponInput } from "./validate";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const [coupons, paid, pending, products, categories] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.order.groupBy({
      by: ["couponCode"],
      where: { couponCode: { not: null }, status: { in: PAID_STATUSES } },
      _count: { _all: true },
      _sum: { total: true, couponDiscount: true },
    }),
    prisma.order.groupBy({
      by: ["couponCode"],
      where: { couponCode: { not: null }, status: "PENDING", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      _count: { _all: true },
    }),
    prisma.product.findMany({ where: { active: true }, select: { id: true, name: true, categoryId: true }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const paidMap = new Map(paid.map((p) => [p.couponCode, p]));
  const pendingMap = new Map(pending.map((p) => [p.couponCode, p._count._all]));

  return NextResponse.json({
    coupons: coupons.map((c) => {
      const s = paidMap.get(c.code);
      return {
        ...c,
        stats: {
          uses: s?._count._all ?? 0,
          pending: pendingMap.get(c.code) ?? 0,
          revenue: s?._sum.total ?? 0,
          discount: s?._sum.couponDiscount ?? 0,
        },
      };
    }),
    products,
    categories,
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = parseCouponInput(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const exists = await prisma.coupon.findUnique({ where: { code: parsed.data.code } });
  if (exists) return NextResponse.json({ error: `Já existe um cupom com o código ${parsed.data.code}` }, { status: 409 });

  const coupon = await prisma.coupon.create({ data: parsed.data });
  return NextResponse.json(coupon, { status: 201 });
}
