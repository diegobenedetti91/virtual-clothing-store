import { prisma } from "@/lib/prisma";

const r2 = (n: number) => Math.round(n * 100) / 100;

type TicketOrder = { total: number; shippingCost: number | null; couponCode?: string | null };

/** Códigos de cupom de frete grátis entre os pedidos (o frete desses pedidos já foi zerado pelo cupom). */
export async function freeShippingCoupons(orders: TicketOrder[]): Promise<Set<string>> {
  const codes = [...new Set(orders.map((o) => o.couponCode?.trim().toUpperCase()).filter((c): c is string => !!c))];
  if (!codes.length) return new Set();
  const rows = await prisma.coupon.findMany({ where: { code: { in: codes }, type: "FREE_SHIPPING" }, select: { code: true } });
  return new Set(rows.map((r) => r.code.toUpperCase()));
}

/**
 * Valor dos produtos que o cliente pagou (já com cupom e desconto Pix), sem o frete —
 * o frete vai para a transportadora e não entra no ticket médio.
 */
export function productNet(o: TicketOrder, freeShipping: Set<string>): number {
  const code = o.couponCode?.trim().toUpperCase();
  const shippingPaid = code && freeShipping.has(code) ? 0 : o.shippingCost || 0;
  return Math.max(0, r2(o.total - shippingPaid));
}

/** Ticket médio = soma do valor dos produtos (sem frete) ÷ número de pedidos. */
export function averageTicket(orders: TicketOrder[], freeShipping: Set<string>): number {
  return orders.length ? r2(orders.reduce((s, o) => s + productNet(o, freeShipping), 0) / orders.length) : 0;
}
