import { prisma } from "@/lib/prisma";
import type { Coupon } from "@prisma/client";

/** Status em que o pedido conta como compra feita (pagamento aprovado). */
export const PAID_STATUSES = ["CONFIRMED", "SHIPPED", "DELIVERED", "PRONTO_PARA_RETIRADA", "RETIRADO"];
/** Pedido aguardando pagamento "segura" o uso do cupom por este tempo. */
const RESERVATION_MS = 24 * 60 * 60 * 1000;

export type CouponType = "PERCENT" | "FIXED" | "FREE_SHIPPING";

export const normalizeCouponCode = (code: unknown) =>
  typeof code === "string" ? code.trim().toUpperCase().replace(/\s+/g, "").slice(0, 40) : "";

const round2 = (n: number) => Math.round(n * 100) / 100;
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function parseIdList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export interface CouponCustomer {
  id?: string | null;
  email?: string | null;
  cpfCnpj?: string | null;
}

export interface CouponLine {
  productId: string;
  categoryId: string | null;
  price: number;
  quantity: number;
}

export type CouponResult =
  | {
      ok: true;
      coupon: Coupon;
      itemDiscount: number;
      shippingDiscount: number;
      /** Mensagem amigável para mostrar ao cliente (ex.: "Frete grátis aplicado") */
      message: string;
    }
  | { ok: false; error: string };

/** Formas em que um CPF/CNPJ pode estar salvo nos pedidos antigos. */
function documentVariants(doc: string | null | undefined): string[] {
  const d = (doc || "").replace(/\D/g, "");
  if (d.length === 11) return [d, d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")];
  if (d.length === 14) return [d, d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")];
  return [];
}

function identityWhere(customer: CouponCustomer) {
  const or: Record<string, unknown>[] = [];
  if (customer.id) or.push({ customerId: customer.id });
  const email = customer.email?.trim();
  if (email) or.push({ customerEmail: email }); // collation do MySQL já ignora maiúsculas
  const docs = documentVariants(customer.cpfCnpj);
  if (docs.length) or.push({ cpfCnpj: { in: docs } });
  return or;
}

const usageWhere = (code: string) => ({
  couponCode: code,
  OR: [{ status: { in: PAID_STATUSES } }, { status: "PENDING", createdAt: { gte: new Date(Date.now() - RESERVATION_MS) } }],
});

/**
 * Valida o cupom e calcula o desconto. Tudo no servidor.
 * `strict` (finalizar pedido) exige CPF/e-mail para regras por cliente;
 * no modo de cotação o cupom é aceito e a regra é conferida ao finalizar.
 */
export async function evaluateCoupon(input: {
  code: string;
  lines: CouponLine[];
  shippingCost: number;
  /** false enquanto o cliente ainda não escolheu o frete */
  shippingChosen: boolean;
  customer: CouponCustomer;
  strict: boolean;
}): Promise<CouponResult> {
  const code = normalizeCouponCode(input.code);
  if (!code) return { ok: false, error: "Digite o código do cupom" };

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) return { ok: false, error: "Cupom inválido" };

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return { ok: false, error: `Este cupom vale a partir de ${coupon.startsAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` };
  }
  if (coupon.endsAt && coupon.endsAt < now) return { ok: false, error: "Este cupom expirou" };

  // Produtos participantes
  const productIds = parseIdList(coupon.productIds);
  const categoryIds = parseIdList(coupon.categoryIds);
  const restricted = productIds.length > 0 || categoryIds.length > 0;
  const eligible = restricted
    ? input.lines.filter((l) => productIds.includes(l.productId) || (l.categoryId != null && categoryIds.includes(l.categoryId)))
    : input.lines;
  const eligibleSubtotal = round2(eligible.reduce((s, l) => s + l.price * l.quantity, 0));
  if (eligibleSubtotal <= 0) return { ok: false, error: "Este cupom não vale para os produtos do seu carrinho" };

  if (coupon.minOrderValue && eligibleSubtotal < coupon.minOrderValue) {
    const missing = brl(coupon.minOrderValue - eligibleSubtotal);
    return {
      ok: false,
      error: restricted
        ? `Faltam ${missing} em produtos participantes para usar este cupom`
        : `Faltam ${missing} para usar este cupom (pedido mínimo de ${brl(coupon.minOrderValue)})`,
    };
  }

  // Limite total de usos
  if (coupon.usageLimit != null) {
    const used = await prisma.order.count({ where: usageWhere(code) });
    if (used >= coupon.usageLimit) return { ok: false, error: "Este cupom atingiu o limite de usos" };
  }

  // Regras por cliente
  const needsIdentity = coupon.firstPurchaseOnly || coupon.perCustomerLimit != null;
  const identity = identityWhere(input.customer);
  if (needsIdentity && identity.length === 0 && input.strict) {
    return { ok: false, error: "Informe seu CPF e e-mail para usar este cupom" };
  }
  if (identity.length > 0) {
    if (coupon.firstPurchaseOnly) {
      const previous = await prisma.order.findFirst({ where: { status: { in: PAID_STATUSES }, OR: identity }, select: { id: true } });
      if (previous) return { ok: false, error: "Este cupom é válido somente na primeira compra" };
    }
    if (coupon.perCustomerLimit != null) {
      const mine = await prisma.order.count({ where: { AND: [usageWhere(code), { OR: identity }] } });
      if (mine >= coupon.perCustomerLimit) {
        return { ok: false, error: coupon.perCustomerLimit === 1 ? "Você já usou este cupom" : "Você já atingiu o limite de usos deste cupom" };
      }
    }
  }

  // Desconto
  let itemDiscount = 0;
  let shippingDiscount = 0;
  let message: string;
  if (coupon.type === "FREE_SHIPPING") {
    shippingDiscount = round2(input.shippingCost);
    message = input.shippingChosen ? "Frete grátis aplicado" : "Frete grátis — escolha a entrega para ver o desconto";
  } else if (coupon.type === "FIXED") {
    itemDiscount = round2(Math.min(coupon.value, eligibleSubtotal));
    message = `${brl(itemDiscount)} de desconto`;
  } else {
    itemDiscount = round2((eligibleSubtotal * coupon.value) / 100);
    if (coupon.maxDiscount != null && itemDiscount > coupon.maxDiscount) itemDiscount = round2(coupon.maxDiscount);
    message = `${coupon.value.toLocaleString("pt-BR")}% de desconto${restricted ? " nos produtos participantes" : ""}`;
  }
  if (needsIdentity && identity.length === 0) message += " (confirmado ao finalizar com seu CPF/e-mail)";

  return { ok: true, coupon, itemDiscount, shippingDiscount, message };
}
