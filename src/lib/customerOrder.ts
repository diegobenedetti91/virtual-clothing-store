import type { Prisma } from "@prisma/client";

/**
 * Prazo para pedir devolução: 7 dias corridos a partir do RECEBIMENTO
 * (direito de arrependimento, CDC art. 49). Mesma regra usada em /api/returns.
 */
export const RETURN_DAYS = 7;
const DAY = 86400000;

/** Data em que o cliente recebeu (entregue ou retirado). Pedidos antigos sem a data usam a última atualização. */
export function receivedAt(order: { status: string; deliveredAt?: Date | string | null; updatedAt: Date | string }) {
  if (order.status !== "DELIVERED" && order.status !== "RETIRADO") return null;
  return new Date(order.deliveredAt ?? order.updatedAt);
}

/** Fim do prazo de devolução (7 × 24 h após o recebimento), ou null se ainda não recebeu. */
export function returnDeadline(order: Parameters<typeof receivedAt>[0]) {
  const r = receivedAt(order);
  return r ? new Date(r.getTime() + RETURN_DAYS * DAY) : null;
}

/**
 * Campos do pedido que o próprio cliente pode ver.
 * Nunca inclui dados internos: IDs do Bling/Melhor Envio, taxa do gateway, IP,
 * user agent, cookies do Meta, observações internas ou erros de integração.
 */
export const CUSTOMER_ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deliveredAt: true,
  customerId: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  cpfCnpj: true,
  address: true,
  streetNumber: true,
  neighborhood: true,
  city: true,
  state: true,
  zipCode: true,
  subtotal: true,
  shippingCost: true,
  shippingMethod: true,
  total: true,
  couponCode: true,
  couponDiscount: true,
  paymentMethod: true,
  cancelReason: true,
  trackingCode: true,
  trackingUrl: true,
  shipmentStatus: true,
  lastTrackingUpdate: true,
  returnStatus: true,
  items: {
    select: {
      id: true,
      productId: true,
      quantity: true,
      price: true,
      size: true,
      color: true,
      selectedAttributes: true,
      product: { select: { id: true, name: true, images: true, slug: true } },
    },
  },
  returns: {
    select: { id: true, status: true, createdAt: true, trackingCode: true, refundAmount: true, refundedAt: true },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.OrderSelect;

export type CustomerOrderRow = Prisma.OrderGetPayload<{ select: typeof CUSTOMER_ORDER_SELECT }>;

/** O que o cliente pode fazer agora com o pedido (mesmas regras validadas nas rotas). */
export function customerActions(order: Pick<CustomerOrderRow, "status" | "updatedAt" | "deliveredAt" | "returns">) {
  const openReturn = order.returns.some((r) => r.status === "PENDING" || r.status === "AWAITING_RETURN");
  const deadline = returnDeadline(order);
  const msLeft = deadline ? deadline.getTime() - Date.now() : -1;
  return {
    canCancel: order.status === "CONFIRMED",
    canReturn: !!deadline && msLeft > 0 && !openReturn,
    returnDaysLeft: Math.max(0, Math.ceil(msLeft / DAY)),
    returnDeadline: deadline ? deadline.toISOString() : null,
  };
}

/** Mascara o documento: 123.***.***-09 */
export function maskDocument(doc: string | null) {
  const d = (doc || "").replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.***.***/****-${d.slice(12)}`;
  return null;
}
