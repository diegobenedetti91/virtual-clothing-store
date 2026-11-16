import { prisma } from "@/lib/prisma";
import { freeShippingCoupons } from "@/lib/ticket";
import { splitReturnRefund, type RefundSplit } from "@/lib/refundCalc";

type Item = { itemId: string; quantity: number };

function parseItems(value: unknown): Item[] {
  let v = value;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return []; } }
  return Array.isArray(v) ? (v as Item[]).filter((i) => typeof i?.itemId === "string" && typeof i?.quantity === "number") : [];
}

/**
 * Estorno de uma devolução (dinheiro + crédito), pelo que o cliente pagou pelas peças,
 * descontando o que devoluções anteriores já devolveram. `excludeReturnId`: a própria devolução.
 */
export async function computeReturnRefund(orderId: string, returnedItems: unknown, excludeReturnId?: string): Promise<RefundSplit> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      subtotal: true, shippingCost: true, total: true, couponDiscount: true, couponCode: true, creditUsed: true,
      items: { select: { id: true, price: true } },
      returns: { where: { status: "APPROVED", ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}) }, select: { returnedItems: true, refundAmount: true, refundCredit: true } },
    },
  });
  if (!order) return { listValue: 0, money: 0, credit: 0 };
  const priceOf = new Map(order.items.map((i) => [i.id, i.price]));
  const listOf = (items: Item[]) => items.reduce((s, i) => s + (priceOf.get(i.itemId) ?? 0) * i.quantity, 0);

  const free = await freeShippingCoupons([order]);
  const input = {
    subtotal: order.subtotal,
    shippingCost: order.shippingCost,
    total: order.total,
    couponDiscount: order.couponDiscount || 0,
    freeShippingCoupon: !!order.couponCode && free.has(order.couponCode.trim().toUpperCase()),
    creditUsed: order.creditUsed || 0,
  };
  const prevMoney = order.returns.reduce((s, r) => s + (r.refundAmount || 0), 0);
  const prevCredit = order.returns.reduce((s, r) => s + (r.refundCredit || 0), 0);
  const prevList = order.returns.reduce((s, r) => s + listOf(parseItems(r.returnedItems)), 0);
  return splitReturnRefund(input, listOf(parseItems(returnedItems)), prevMoney, prevCredit, prevList);
}
