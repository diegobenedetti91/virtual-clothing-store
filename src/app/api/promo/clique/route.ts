import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Clique no e-mail de promoção: registra (para medir o resultado) e leva ao produto. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("e") || "";
  const home = new URL("/produtos", req.nextUrl.origin);
  if (!/^[\w-]{10,40}$/.test(id)) return NextResponse.redirect(home);
  const email = await prisma.promoEmail.findUnique({
    where: { id },
    select: { clickedAt: true, campaignId: true, campaign: { select: { reason: true, product: { select: { slug: true } } } } },
  });
  if (!email) return NextResponse.redirect(home);
  if (!email.clickedAt) await prisma.promoEmail.update({ where: { id }, data: { clickedAt: new Date() } }).catch(() => {});
  const to = new URL(`/produtos/${email.campaign.product.slug}`, req.nextUrl.origin);
  to.searchParams.set("utm_source", "email");
  to.searchParams.set("utm_medium", "promo");
  to.searchParams.set("utm_campaign", `interesse-${email.campaign.reason.toLowerCase()}`);
  return NextResponse.redirect(to);
}
