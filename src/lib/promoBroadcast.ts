/**
 * Aviso de cupom novo / promoção relâmpago para TODA a base de clientes.
 *
 * Automático: sai quando o cupom/promoção começa (na criação, se já começou; senão pela rotina horária),
 * se "Avisar clientes por e-mail" estiver marcado no cadastro.
 *
 * Regras (LGPD e anti-spam):
 *  - só clientes com conta que NÃO pediram para não receber promoções;
 *  - respeita o limite de PROMO_LIMIT e-mails de promoção por cliente a cada PROMO_WINDOW_DAYS dias
 *    (o mesmo dos avisos de produto) — quem já atingiu fica de fora deste aviso;
 *  - cupom de primeira compra vai só para quem nunca comprou;
 *  - todo e-mail tem o link "Não quero receber".
 * Envio em lotes (BATCH por rodada) para não estourar o limite do servidor de e-mail; a rotina
 * horária continua de onde parou (cursor), sem repetir ninguém.
 */
import { prisma } from "@/lib/prisma";
import { flashPrice } from "@/lib/flashSales";
import { PROMO_LIMIT, PROMO_WINDOW_DAYS, unsubscribeToken } from "@/lib/promoInterest";
import { sendPromoBroadcastEmail } from "@/lib/email";
import { siteUrl, absoluteUrl } from "@/lib/site";

const BATCH = 150;
const DAY = 86_400_000;
const MIN_REMAINING_MS = 2 * 3600_000; // não avisa promoção que já está acabando
const PAID = ["CONFIRMED", "SHIPPED", "PRONTO_PARA_RETIRADA", "DELIVERED", "RETIRADO"];
const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export interface BroadcastOffer {
  subject: string;
  headline: string;
  detail: string;
  couponCode: string | null;
  endsAt: Date | null;
  product: { name: string; image: string | null; priceBefore: number; priceNow: number } | null;
  cta: string;
}

function firstImage(images: string | null): string | null {
  try {
    const list = JSON.parse(images || "[]");
    return Array.isArray(list) && list[0] ? absoluteUrl(String(list[0])) : null;
  } catch {
    return null;
  }
}

// ───────────────────────── Ofertas ─────────────────────────

async function couponOffer(code: string, storeName: string): Promise<BroadcastOffer | null> {
  const c = await prisma.coupon.findUnique({ where: { code } });
  const now = new Date();
  if (!c || !c.active || (c.startsAt && c.startsAt > now) || (c.endsAt && c.endsAt.getTime() < now.getTime() + MIN_REMAINING_MS)) return null;
  const value =
    c.type === "FREE_SHIPPING" ? "Frete grátis" : c.type === "FIXED" ? `${brl(c.value)} de desconto` : `${c.value % 1 ? c.value.toFixed(1) : c.value}% OFF`;
  const restricted = !!((c.productIds && c.productIds !== "[]") || (c.categoryIds && c.categoryIds !== "[]"));
  const rules = [
    c.minOrderValue ? `em compras a partir de ${brl(c.minOrderValue)}` : "",
    restricted ? "em produtos selecionados" : "",
    c.type === "PERCENT" && c.maxDiscount ? `até ${brl(c.maxDiscount)} de desconto` : "",
    c.firstPurchaseOnly ? "na sua primeira compra" : "",
  ].filter(Boolean);
  return {
    subject: `${value} na ${storeName} com o cupom ${c.code}`,
    headline: `${value} para você`,
    detail: `${c.description ? `${c.description}. ` : ""}Use o cupom no checkout${rules.length ? ` — ${rules.join(", ")}` : ""}.`,
    couponCode: c.code,
    endsAt: c.endsAt,
    product: null,
    cta: "Usar meu cupom",
  };
}

async function flashOffer(id: string): Promise<BroadcastOffer | null> {
  const s = await prisma.flashSale.findUnique({
    where: { id },
    include: { product: { select: { name: true, price: true, images: true, active: true } } },
  });
  const now = Date.now();
  if (!s || !s.active || !s.product?.active || s.startAt.getTime() > now || s.endAt.getTime() < now + MIN_REMAINING_MS) return null;
  const priceNow = flashPrice(s.product.price, s);
  const off = s.discountType === "FIXED" ? `${brl(s.discountValue)} OFF` : `${s.discountValue % 1 ? s.discountValue.toFixed(1) : s.discountValue}% OFF`;
  return {
    subject: `⚡ ${s.title}: ${s.product.name} com ${off}`,
    headline: `⚡ ${s.title}`,
    detail: `${s.product.name} com ${off} por tempo limitado.`,
    couponCode: null,
    endsAt: s.endAt,
    product: { name: s.product.name, image: firstImage(s.product.images), priceBefore: s.product.price, priceNow },
    cta: "Aproveitar agora",
  };
}

async function offerFor(c: { couponCode: string | null; flashSaleId: string | null }, storeName: string) {
  if (c.flashSaleId) return flashOffer(c.flashSaleId);
  if (c.couponCode) return couponOffer(c.couponCode, storeName);
  return null;
}

// ───────────────────────── Disparo ─────────────────────────

async function storeName() {
  const s = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { name: true } });
  return s?.name || "Loja";
}

/** Cupom começou: cria a campanha (uma vez só) e envia o primeiro lote. */
export async function startCouponBroadcast(couponId: string) {
  const c = await prisma.coupon.findUnique({ where: { id: couponId } });
  if (!c || !c.notifyCustomers || c.notifySent) return null;
  const name = await storeName();
  if (!(await couponOffer(c.code, name))) return null; // ainda não começou, inativo ou acabando
  const claimed = await prisma.coupon.updateMany({ where: { id: couponId, notifySent: false }, data: { notifySent: true } });
  if (claimed.count === 0) return null;
  const campaign = await prisma.promoCampaign.create({
    data: { reason: "COUPON", couponCode: c.code, trigger: "auto", audience: c.firstPurchaseOnly ? "NEVER_BOUGHT" : "ALL" },
  });
  return sendBroadcastBatch(campaign.id);
}

/** Promoção relâmpago começou: cria a campanha (uma vez só) e envia o primeiro lote. */
export async function startFlashBroadcast(flashSaleId: string) {
  const s = await prisma.flashSale.findUnique({ where: { id: flashSaleId } });
  if (!s || !s.notifyCustomers || s.notifySent || !s.productId) return null;
  if (!(await flashOffer(flashSaleId))) return null;
  const claimed = await prisma.flashSale.updateMany({ where: { id: flashSaleId, notifySent: false }, data: { notifySent: true } });
  if (claimed.count === 0) return null;
  const campaign = await prisma.promoCampaign.create({
    data: { productId: s.productId, reason: "FLASH_SALE", flashSaleId, trigger: "auto", audience: "ALL" },
  });
  return sendBroadcastBatch(campaign.id);
}

/** Envia o próximo lote da campanha. Termina quando passa por todos os clientes ou a oferta acaba. */
export async function sendBroadcastBatch(campaignId: string): Promise<{ sent: number; skipped: number; finished: boolean }> {
  const campaign = await prisma.promoCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || !campaign.audience || campaign.finishedAt) return { sent: 0, skipped: 0, finished: true };
  const name = await storeName();
  const offer = await offerFor(campaign, name);
  if (!offer) {
    await prisma.promoCampaign.update({ where: { id: campaignId }, data: { finishedAt: new Date() } });
    return { sent: 0, skipped: 0, finished: true };
  }

  const customers = await prisma.customerUser.findMany({
    where: {
      ...(campaign.cursor ? { id: { gt: campaign.cursor } } : {}),
      ...(campaign.audience === "NEVER_BOUGHT" ? { orders: { none: { status: { in: PAID } } } } : {}),
    },
    select: { id: true, email: true, name: true, marketingOptOut: true },
    orderBy: { id: "asc" },
    take: BATCH,
  });

  const base = siteUrl();
  const windowStart = new Date(Date.now() - PROMO_WINDOW_DAYS * DAY);
  let sent = 0;
  let skipped = 0;
  for (const c of customers) {
    // LGPD: pediu para não receber
    if (c.marketingOptOut || !c.email) { skipped++; continue; }
    // Limite mensal de e-mails de promoção (o mesmo dos avisos de produto)
    const recent = await prisma.promoEmail.count({ where: { customerId: c.id, sentAt: { gte: windowStart } } });
    if (recent >= PROMO_LIMIT) { skipped++; continue; }
    const log = await prisma.promoEmail.create({ data: { campaignId, customerId: c.id, productId: campaign.productId } });
    try {
      await sendPromoBroadcastEmail({
        to: c.email,
        customerName: c.name,
        storeName: name,
        offer,
        clickUrl: `${base}/api/promo/clique?e=${log.id}`,
        unsubscribeUrl: `${base}/api/promo/sair?t=${encodeURIComponent(unsubscribeToken(c.id))}`,
      });
      sent++;
    } catch (e) {
      await prisma.promoEmail.delete({ where: { id: log.id } }).catch(() => {});
      skipped++;
      console.error("[PROMO BROADCAST] Falha ao enviar:", e);
    }
  }

  const finished = customers.length < BATCH;
  await prisma.promoCampaign.update({
    where: { id: campaignId },
    data: {
      sent: { increment: sent },
      skipped: { increment: skipped },
      cursor: customers.length ? customers[customers.length - 1].id : campaign.cursor,
      ...(finished ? { finishedAt: new Date() } : {}),
    },
  });
  return { sent, skipped, finished };
}

/**
 * Rotina (update-tracking, a cada hora): dispara cupons/promoções que começaram e continua
 * os envios em andamento. Não lança erro.
 */
export async function processPromoBroadcasts() {
  const now = new Date();
  const soon = new Date(now.getTime() + MIN_REMAINING_MS);
  const [coupons, sales] = await Promise.all([
    prisma.coupon.findMany({
      where: { active: true, notifyCustomers: true, notifySent: false, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: soon } }] }] },
      select: { id: true },
      take: 5,
    }),
    prisma.flashSale.findMany({
      where: { active: true, notifyCustomers: true, notifySent: false, productId: { not: null }, startAt: { lte: now }, endAt: { gt: soon } },
      select: { id: true },
      take: 5,
    }),
  ]);
  let started = 0;
  for (const c of coupons) if (await startCouponBroadcast(c.id).catch((e) => console.error("[PROMO BROADCAST] cupom", e))) started++;
  for (const s of sales) if (await startFlashBroadcast(s.id).catch((e) => console.error("[PROMO BROADCAST] relâmpago", e))) started++;

  // Envios em andamento (lotes)
  const open = await prisma.promoCampaign.findMany({
    where: { audience: { not: null }, finishedAt: null, createdAt: { gte: new Date(now.getTime() - 7 * DAY) } },
    select: { id: true },
    take: 5,
  });
  let sent = 0;
  for (const c of open) {
    const r = await sendBroadcastBatch(c.id).catch((e) => { console.error("[PROMO BROADCAST] lote", e); return null; });
    sent += r?.sent ?? 0;
  }
  return { started, sent };
}
