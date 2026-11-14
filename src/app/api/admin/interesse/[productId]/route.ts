import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildOffer, getAudience, PROMO_LIMIT, PROMO_WINDOW_DAYS, sendPromoCampaign, type PromoReason } from "@/lib/promoInterest";

type Ctx = { params: Promise<{ productId: string }> };
const REASONS: PromoReason[] = ["PRICE_DROP", "COUPON", "FLASH_SALE"];
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : typeof v === "string" && Number(v) > 0 ? Number(v) : null);

/** Prévia: quem recebe (e quem fica de fora e por quê) + a oferta, ou o motivo de não dar para avisar. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { productId } = await params;
  const sp = req.nextUrl.searchParams;
  const reason = (sp.get("motivo") || "") as PromoReason;
  const [audience, coupons] = await Promise.all([
    getAudience(productId),
    prisma.coupon.findMany({
      where: { active: true, firstPurchaseOnly: false, OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
      select: { code: true, type: true, value: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  const offer = REASONS.includes(reason) ? await buildOffer(productId, reason, { couponCode: sp.get("cupom"), priceBefore: num(sp.get("de")) }) : null;
  return NextResponse.json({
    audience: { interested: audience.interested, eligible: audience.eligible.length, excluded: audience.excluded, sources: audience.sources },
    offer,
    coupons,
    limit: { perCustomer: PROMO_LIMIT, days: PROMO_WINDOW_DAYS },
  });
}

/** Envia: { reason, couponCode?, priceBefore? } */
export async function POST(req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { productId } = await params;
  const body = (await req.json().catch(() => ({}))) as { reason?: string; couponCode?: string; priceBefore?: number; flashSaleId?: string };
  if (!REASONS.includes(body.reason as PromoReason)) return NextResponse.json({ error: "Escolha o motivo do aviso" }, { status: 400 });
  const session = await auth().catch(() => null);
  const r = await sendPromoCampaign({
    productId,
    reason: body.reason as PromoReason,
    couponCode: body.couponCode ?? null,
    priceBefore: num(body.priceBefore),
    flashSaleId: body.flashSaleId ?? null,
    trigger: "manual",
    createdBy: session?.user?.email ?? null,
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 422 });
}
