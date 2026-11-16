import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Clique no e-mail de promoção: registra (para medir o resultado) e leva ao produto. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("e") || "";
  const home = new URL("/produtos", req.nextUrl.origin);
  if (!/^[\w-]{10,40}$/.test(id)) return NextResponse.redirect(home);
  const email = await prisma.promoEmail.findUnique({
    where: { id },
    select: { clickedAt: true, campaignId: true, campaign: { select: { reason: true, couponCode: true, audience: true, product: { select: { slug: true } } } } },
  });
  if (!email) return NextResponse.redirect(home);
  if (!email.clickedAt) await prisma.promoEmail.update({ where: { id }, data: { clickedAt: new Date() } }).catch(() => {});
  const c = email.campaign;
  // Produto da promoção; aviso geral de cupom: vitrine com o cupom já guardado para o checkout (?cupom=)
  const to = new URL(c.product ? `/produtos/${c.product.slug}` : "/produtos", req.nextUrl.origin);
  if (c.couponCode) to.searchParams.set("cupom", c.couponCode);
  to.searchParams.set("utm_source", "email");
  to.searchParams.set("utm_medium", "promo");
  to.searchParams.set("utm_campaign", `${c.audience ? "base" : "interesse"}-${c.reason.toLowerCase()}`);
  return NextResponse.redirect(to);
}
