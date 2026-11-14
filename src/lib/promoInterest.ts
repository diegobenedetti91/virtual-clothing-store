/**
 * "O produto que você viu está em promoção": interesse por produto e avisos por e-mail.
 *
 * Interessados num produto = clientes logados que o viram, adicionaram ao carrinho, favoritaram
 * ou o deixaram num carrinho abandonado — menos quem já comprou e quem pediu para não receber.
 *
 * Trava contra spam: cada cliente recebe no máximo PROMO_LIMIT e-mails de promoção a cada
 * PROMO_WINDOW_DAYS dias, e nunca dois avisos do mesmo produto nesse período.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { flashPrice } from "@/lib/flashSales";
import { parseIdList } from "@/lib/coupons";

export const PROMO_LIMIT = 3;
export const PROMO_WINDOW_DAYS = 30;
const INTEREST_DAYS = 60;
const DAY = 86_400_000;
const PAID = ["CONFIRMED", "SHIPPED", "PRONTO_PARA_RETIRADA", "DELIVERED", "RETIRADO"];

export type PromoReason = "PRICE_DROP" | "COUPON" | "FLASH_SALE";
export const PROMO_REASON_LABEL: Record<PromoReason, string> = {
  PRICE_DROP: "O preço baixou",
  COUPON: "Cupom de desconto",
  FLASH_SALE: "Promoção relâmpago",
};

// ───────────────────────── Interessados ─────────────────────────

export interface Audience {
  /** Interessados (antes das exclusões) */
  interested: number;
  eligible: { id: string; email: string; name: string }[];
  excluded: { bought: number; optOut: number; monthlyLimit: number; sameProduct: number };
  /** De onde veio o interesse dos elegíveis */
  sources: { viewed: number; cart: number; wishlist: number };
}

/** Ids dos clientes interessados num produto, com a origem do interesse. */
async function interestedCustomers(productId: string) {
  const since = new Date(Date.now() - INTEREST_DAYS * DAY);
  const [events, wishes, carts] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: { productId, type: { in: ["PRODUCT_VIEW", "ADD_TO_CART"] }, customerId: { not: null }, createdAt: { gte: since } },
      select: { customerId: true, type: true },
      distinct: ["customerId", "type"],
    }),
    prisma.wishlistItem.findMany({ where: { productId }, select: { customerId: true } }),
    prisma.abandonedCart.findMany({
      where: { closedAt: null, cartItems: { contains: productId }, updatedAt: { gte: since } },
      select: { customerId: true, email: true },
    }),
  ]);
  const viewed = new Set(events.filter((e) => e.type === "PRODUCT_VIEW").map((e) => e.customerId!));
  const cart = new Set(events.filter((e) => e.type === "ADD_TO_CART").map((e) => e.customerId!));
  const wishlist = new Set(wishes.map((w) => w.customerId));
  // Carrinho abandonado pode não ter customerId: resolve pelo e-mail
  const cartEmails = carts.filter((c) => !c.customerId).map((c) => c.email.toLowerCase());
  for (const c of carts) if (c.customerId) cart.add(c.customerId);
  if (cartEmails.length) {
    const byEmail = await prisma.customerUser.findMany({ where: { email: { in: cartEmails } }, select: { id: true } });
    for (const c of byEmail) cart.add(c.id);
  }
  return { viewed, cart, wishlist, all: new Set([...viewed, ...cart, ...wishlist]) };
}

/** Quem vai receber o aviso deste produto agora, e por que os outros ficam de fora. */
export async function getAudience(productId: string): Promise<Audience> {
  const { viewed, cart, wishlist, all } = await interestedCustomers(productId);
  const ids = [...all];
  if (!ids.length) {
    return { interested: 0, eligible: [], excluded: { bought: 0, optOut: 0, monthlyLimit: 0, sameProduct: 0 }, sources: { viewed: 0, cart: 0, wishlist: 0 } };
  }
  const windowStart = new Date(Date.now() - PROMO_WINDOW_DAYS * DAY);
  const [customers, buyers, recent] = await Promise.all([
    prisma.customerUser.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, name: true, marketingOptOut: true } }),
    prisma.orderItem.findMany({
      where: { productId, order: { customerId: { in: ids }, status: { in: PAID } } },
      select: { order: { select: { customerId: true } } },
    }),
    prisma.promoEmail.findMany({ where: { customerId: { in: ids }, sentAt: { gte: windowStart } }, select: { customerId: true, productId: true } }),
  ]);
  const bought = new Set(buyers.map((b) => b.order.customerId!));
  const countByCustomer = new Map<string, number>();
  const sameProduct = new Set<string>();
  for (const r of recent) {
    countByCustomer.set(r.customerId, (countByCustomer.get(r.customerId) || 0) + 1);
    if (r.productId === productId) sameProduct.add(r.customerId);
  }

  const excluded = { bought: 0, optOut: 0, monthlyLimit: 0, sameProduct: 0 };
  const eligible: Audience["eligible"] = [];
  for (const c of customers) {
    if (bought.has(c.id)) { excluded.bought++; continue; }
    if (c.marketingOptOut) { excluded.optOut++; continue; }
    if (sameProduct.has(c.id)) { excluded.sameProduct++; continue; }
    if ((countByCustomer.get(c.id) || 0) >= PROMO_LIMIT) { excluded.monthlyLimit++; continue; }
    eligible.push({ id: c.id, email: c.email, name: c.name });
  }
  const el = new Set(eligible.map((e) => e.id));
  return {
    interested: customers.length,
    eligible,
    excluded,
    sources: {
      viewed: [...viewed].filter((id) => el.has(id)).length,
      cart: [...cart].filter((id) => el.has(id)).length,
      wishlist: [...wishlist].filter((id) => el.has(id)).length,
    },
  };
}

// ───────────────────────── Oferta ─────────────────────────

export interface Offer {
  reason: PromoReason;
  product: { id: string; name: string; slug: string; image: string | null };
  priceBefore: number | null;
  priceNow: number;
  headline: string;
  detail: string;
  couponCode: string | null;
  flashSaleId: string | null;
  endsAt: string | null;
}

const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

/** Monta e valida a oferta (não envia aviso de "preço baixou" se o preço não baixou, cupom inválido etc.). */
export async function buildOffer(
  productId: string,
  reason: PromoReason,
  opts: { couponCode?: string | null; priceBefore?: number | null; flashSaleId?: string | null } = {}
): Promise<Offer | { error: string }> {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, slug: true, price: true, comparePrice: true, images: true, active: true, stock: true, categoryId: true },
  });
  if (!p || !p.active) return { error: "Produto não encontrado ou inativo" };
  if (p.stock <= 0) return { error: "Produto sem estoque: avisar agora frustraria o cliente" };
  let image: string | null = null;
  try { image = (JSON.parse(p.images || "[]") as string[])[0] ?? null; } catch {}
  const product = { id: p.id, name: p.name, slug: p.slug, image };

  if (reason === "PRICE_DROP") {
    const before = opts.priceBefore ?? p.comparePrice ?? null;
    if (!before || before <= p.price) return { error: "Para avisar que o preço baixou, o preço atual precisa ser menor que o anterior (preço “de”)." };
    const pct = Math.round((1 - p.price / before) * 100);
    return {
      reason, product, priceBefore: before, priceNow: p.price, couponCode: null, flashSaleId: null, endsAt: null,
      headline: `Baixou de preço: ${pct}% off`, detail: `De ${brl(before)} por ${brl(p.price)}`,
    };
  }

  if (reason === "COUPON") {
    const code = (opts.couponCode || "").trim().toUpperCase();
    if (!code) return { error: "Escolha o cupom" };
    const now = new Date();
    const c = await prisma.coupon.findUnique({ where: { code } });
    if (!c || !c.active || (c.startsAt && c.startsAt > now) || (c.endsAt && c.endsAt < now)) return { error: "Cupom inexistente, inativo ou fora da validade" };
    if (c.firstPurchaseOnly) return { error: "Este cupom é só para primeira compra: não serve para quem já é cliente" };
    const onlyProducts = parseIdList(c.productIds);
    const onlyCategories = parseIdList(c.categoryIds);
    if ((onlyProducts.length || onlyCategories.length) && !onlyProducts.includes(productId) && !onlyCategories.includes(p.categoryId)) {
      return { error: "Este cupom não vale para este produto" };
    }
    const off = c.type === "FREE_SHIPPING" ? "Frete grátis" : c.type === "FIXED" ? `${brl(c.value)} de desconto` : `${c.value.toLocaleString("pt-BR")}% de desconto`;
    return {
      reason, product, priceBefore: null, priceNow: p.price, couponCode: c.code, flashSaleId: null,
      endsAt: c.endsAt ? c.endsAt.toISOString() : null,
      headline: `${off} com o cupom ${c.code}`,
      detail: c.minOrderValue ? `Em compras a partir de ${brl(c.minOrderValue)}` : "Use o cupom no checkout",
    };
  }

  // FLASH_SALE
  const now = new Date();
  const sale = await prisma.flashSale.findFirst({
    where: { productId, active: true, startAt: { lte: now }, endAt: { gte: now }, ...(opts.flashSaleId ? { id: opts.flashSaleId } : {}) },
    orderBy: { endAt: "asc" },
  });
  if (!sale) return { error: "Não há promoção relâmpago ativa agora para este produto" };
  const priceNow = flashPrice(p.price, sale);
  return {
    reason, product, priceBefore: p.price, priceNow, couponCode: null, flashSaleId: sale.id, endsAt: sale.endAt.toISOString(),
    headline: `Promoção relâmpago: ${brl(priceNow)}`,
    detail: `De ${brl(p.price)} por ${brl(priceNow)} — só até ${sale.endAt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
  };
}

// ───────────────────────── Descadastro ─────────────────────────

function secret() {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET não configurado");
  return s;
}
export function unsubscribeToken(customerId: string) {
  const sig = createHmac("sha256", secret()).update(`promo-optout:${customerId}`).digest("base64url").slice(0, 32);
  return `${customerId}.${sig}`;
}
export function verifyUnsubscribeToken(token: string): string | null {
  const [id, sig] = token.split(".");
  if (!id || !sig) return null;
  const expected = Buffer.from(unsubscribeToken(id).split(".")[1]);
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
}

// ───────────────────────── Envio ─────────────────────────

export interface CampaignResult { ok: boolean; campaignId?: string; sent: number; skipped: number; message: string }

/** Envia o aviso para os interessados elegíveis (respeitando a trava) e registra a campanha. */
export async function sendPromoCampaign(input: {
  productId: string;
  reason: PromoReason;
  couponCode?: string | null;
  priceBefore?: number | null;
  flashSaleId?: string | null;
  trigger?: "manual" | "auto";
  createdBy?: string | null;
}): Promise<CampaignResult> {
  const offer = await buildOffer(input.productId, input.reason, input);
  if ("error" in offer) return { ok: false, sent: 0, skipped: 0, message: offer.error };
  const audience = await getAudience(input.productId);
  if (!audience.eligible.length) {
    return { ok: false, sent: 0, skipped: audience.interested, message: audience.interested ? "Todos os interessados já foram avisados recentemente, já compraram ou não querem receber." : "Ninguém demonstrou interesse neste produto ainda." };
  }

  const { sendPromoProductEmail } = await import("@/lib/email");
  const { siteUrl } = await import("@/lib/site");
  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { name: true } });
  const storeName = settings?.name || "Loja";
  const base = siteUrl();

  const campaign = await prisma.promoCampaign.create({
    data: {
      productId: input.productId, reason: input.reason, couponCode: offer.couponCode, flashSaleId: offer.flashSaleId,
      priceBefore: offer.priceBefore, priceAfter: offer.priceNow, trigger: input.trigger ?? "manual", createdBy: input.createdBy ?? null,
    },
  });
  if (offer.flashSaleId) await prisma.flashSale.update({ where: { id: offer.flashSaleId }, data: { notifySent: true } }).catch(() => {});

  let sent = 0;
  for (const c of audience.eligible.slice(0, 1000)) {
    // Reconfere a trava na hora (outra campanha pode ter saído em paralelo)
    const recent = await prisma.promoEmail.count({ where: { customerId: c.id, sentAt: { gte: new Date(Date.now() - PROMO_WINDOW_DAYS * DAY) } } });
    if (recent >= PROMO_LIMIT) continue;
    const log = await prisma.promoEmail.create({ data: { campaignId: campaign.id, customerId: c.id, productId: input.productId } });
    try {
      await sendPromoProductEmail({
        to: c.email,
        customerName: c.name,
        storeName,
        offer,
        productUrl: `${base}/api/promo/clique?e=${log.id}`,
        unsubscribeUrl: `${base}/api/promo/sair?t=${encodeURIComponent(unsubscribeToken(c.id))}`,
        imageUrl: offer.product.image ? (offer.product.image.startsWith("http") ? offer.product.image : `${base}${offer.product.image}`) : null,
      });
      sent++;
    } catch (e) {
      await prisma.promoEmail.delete({ where: { id: log.id } }).catch(() => {});
      console.error("[PROMO] Falha ao enviar:", e);
    }
  }
  const skipped = audience.interested - sent;
  await prisma.promoCampaign.update({ where: { id: campaign.id }, data: { sent, skipped } });
  return {
    ok: sent > 0,
    campaignId: campaign.id,
    sent,
    skipped,
    message: sent ? `Aviso enviado para ${sent} cliente${sent === 1 ? "" : "s"}${skipped > 0 ? ` (${skipped} ficaram de fora pela trava, compra ou descadastro)` : ""}` : "Nenhum e-mail pôde ser enviado",
  };
}

/** Envio automático (se ligado nas configurações). Não lança erro. */
export async function autoNotify(input: { productId: string; reason: PromoReason; priceBefore?: number | null; flashSaleId?: string | null }) {
  const s = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { promoAutoNotify: true } });
  if (!s?.promoAutoNotify) return null;
  try {
    const r = await sendPromoCampaign({ ...input, trigger: "auto" });
    console.log(`[PROMO] Aviso automático ${input.reason} ${input.productId}: ${r.message}`);
    return r;
  } catch (e) {
    console.error("[PROMO] Aviso automático falhou:", e);
    return null;
  }
}

/** Rotina: promoções relâmpago que começaram e ainda não avisaram ninguém (modo automático). */
export async function processFlashSaleNotifications() {
  const now = new Date();
  const sales = await prisma.flashSale.findMany({
    where: { active: true, notifySent: false, productId: { not: null }, startAt: { lte: now }, endAt: { gte: new Date(now.getTime() + 2 * 3600_000) } },
    select: { id: true, productId: true },
    take: 10,
  });
  for (const s of sales) {
    const r = await autoNotify({ productId: s.productId!, reason: "FLASH_SALE", flashSaleId: s.id });
    // Mesmo sem ninguém para avisar, não tenta de novo a cada rodada
    if (r) await prisma.flashSale.update({ where: { id: s.id }, data: { notifySent: true } }).catch(() => {});
  }
}
