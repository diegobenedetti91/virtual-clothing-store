import { prisma } from "@/lib/prisma";
import { releaseOrderStock } from "@/lib/stockUtils";
import { refundNuPayPayment } from "@/lib/nupay";
import { randomUUID } from "crypto";

// InfinityPay's checkout API has no refund endpoint: refunds are done in their app/panel.
const manualRefundMessage = (gateway: string, amount: number) =>
  `Estorno automático indisponível para ${gateway === "infinitypay" ? "InfinityPay" : gateway}. ` +
  `Faça o estorno de R$ ${amount.toFixed(2)} pelo painel do gateway.`;

export interface RefundResult {
  success: boolean;
  message: string;
  /** true when the gateway has no refund API and the admin must refund by hand */
  manual?: boolean;
}

export async function refundPayment(orderNumber: string): Promise<RefundResult> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true },
  });

  if (!order) {
    return { success: false, message: "Pedido não encontrado" };
  }

  if (!order.paymentGateway || !order.paymentId) {
    return { success: false, message: "Informações de pagamento não disponíveis" };
  }

  if (order.refundedAt) {
    return { success: false, message: "Pedido já foi reembolsado" };
  }

  try {
    if (order.paymentGateway === "mercadopago") {
      await refundMercadoPago(order.paymentId);
    } else if (order.paymentGateway === "nupay") {
      await refundNuPay(order.paymentId, order.total);
    } else if (order.paymentGateway === "infinitypay") {
      return { success: false, manual: true, message: manualRefundMessage(order.paymentGateway, order.total) };
    } else {
      return { success: false, message: "Gateway de pagamento desconhecido" };
    }

    // Mark as refunded and restore stock
    await prisma.order.update({
      where: { orderNumber },
      data: { refundedAt: new Date() },
    });

    await releaseOrderStock(order.id).catch(console.error);

    return { success: true, message: "Reembolso processado com sucesso" };
  } catch (error) {
    console.error("Erro ao reembolsar:", error);
    return { success: false, message: `Erro ao processar reembolso: ${String(error)}` };
  }
}

export async function refundMercadoPago(paymentId: string): Promise<void> {
  const settings = await prisma.companySettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const accessToken = settings?.mercadoPagoAccessToken;
  if (!accessToken) {
    throw new Error("Mercado Pago não configurado");
  }

  // Generate unique idempotency key to prevent duplicate refunds
  const idempotencyKey = `refund-${paymentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": idempotencyKey,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erro ao reembolsar no MP: ${err}`);
  }

  console.log("[REFUND] Mercado Pago refund successful for payment:", paymentId);
}

export async function refundNuPay(pspReferenceId: string, amount: number): Promise<void> {
  // One full refund per payment: a stable key makes a retry idempotent on NuPay's side
  await refundNuPayPayment(pspReferenceId, amount, `full-${pspReferenceId}`, "Cancelamento do pedido");
  console.log("[REFUND] NuPay full refund requested for payment:", pspReferenceId);
}

export async function refundPartialPayment(orderNumber: string, refundAmount: number): Promise<RefundResult> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true },
  });

  if (!order) {
    return { success: false, message: "Pedido não encontrado" };
  }

  if (!order.paymentGateway || !order.paymentId) {
    return { success: false, message: "Informações de pagamento não disponíveis" };
  }

  if (refundAmount <= 0 || refundAmount > order.total) {
    return { success: false, message: "Valor de reembolso inválido" };
  }

  try {
    if (order.paymentGateway === "mercadopago") {
      await refundMercadoPagoPartial(order.paymentId, refundAmount);
    } else if (order.paymentGateway === "nupay") {
      await refundNuPayPartial(order.paymentId, refundAmount);
    } else if (order.paymentGateway === "infinitypay") {
      return { success: false, manual: true, message: manualRefundMessage(order.paymentGateway, refundAmount) };
    } else {
      return { success: false, message: "Gateway de pagamento desconhecido" };
    }

    console.log(`[REFUND] Partial refund of R$ ${refundAmount.toFixed(2)} processed for order ${orderNumber}`);
    return { success: true, message: `Reembolso parcial de R$ ${refundAmount.toFixed(2)} processado com sucesso` };
  } catch (error) {
    console.error("Erro ao reembolsar parcialmente:", error);
    return { success: false, message: `Erro ao processar reembolso: ${String(error)}` };
  }
}

async function refundMercadoPagoPartial(paymentId: string, amount: number): Promise<void> {
  const settings = await prisma.companySettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const accessToken = settings?.mercadoPagoAccessToken;
  if (!accessToken) {
    throw new Error("Mercado Pago não configurado");
  }

  const idempotencyKey = `refund-partial-${paymentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100) / 100,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erro ao reembolsar no MP: ${err}`);
  }

  console.log("[REFUND] Mercado Pago partial refund successful for payment:", paymentId);
}

async function refundNuPayPartial(pspReferenceId: string, amount: number): Promise<void> {
  await refundNuPayPayment(pspReferenceId, amount, `partial-${pspReferenceId}-${randomUUID()}`, "Devolução de itens");
  console.log("[REFUND] NuPay partial refund requested for payment:", pspReferenceId, amount);
}

/** Registra uma ocorrência no pedido (aparece no pedido e nos alertas do painel). */
export async function flagOrderIssue(orderId: string, message: string) {
  await prisma.order.update({ where: { id: orderId }, data: { opsAlert: message.slice(0, 2000), opsAlertAt: new Date() } }).catch(() => {});
}

/**
 * Pagamento aprovado num pedido que já estava cancelado (ex.: Pix pago depois do cancelamento).
 * Estorna automaticamente quando o gateway permite; senão, alerta para estorno manual.
 */
export async function refundPaidAfterCancel(
  order: { id: string; orderNumber: string; refundedAt: Date | null },
  gateway: "mercadopago" | "nupay" | "infinitypay",
  paymentId: string,
  amount: number
) {
  if (order.refundedAt) return; // já estornado (aviso antigo reenviado pelo gateway)
  try {
    if (gateway === "mercadopago") await refundMercadoPago(paymentId);
    else if (gateway === "nupay") await refundNuPay(paymentId, amount);
    else throw new Error("gateway sem estorno por API");
    await prisma.order.update({ where: { id: order.id }, data: { refundedAt: new Date() } });
    await flagOrderIssue(order.id, `Pagamento de R$ ${amount.toFixed(2)} aprovado DEPOIS do cancelamento — estornado automaticamente ao cliente. Confira no gateway.`);
  } catch (e) {
    await flagOrderIssue(order.id, `Pagamento de R$ ${amount.toFixed(2)} aprovado DEPOIS do cancelamento e o estorno automático não foi possível (${e instanceof Error ? e.message : e}). Estorne pelo painel do gateway.`);
  }
}

export const SHIPPED_STATUSES = ["SHIPPED", "DELIVERED", "RETIRADO"];

/**
 * O gateway avisou estorno/contestação num pedido que já saiu da loja.
 * O status do pedido NÃO muda (a peça está com o cliente; devolução segue pelo fluxo de Devoluções).
 * Se o valor estornado não é explicado pelas devoluções aprovadas da loja, alerta o dono (estorno feito
 * fora do sistema ou chargeback).
 */
export async function handleRefundAfterShipping(
  order: { id: string; status: string },
  gatewayLabel: string,
  kind: "refund" | "chargeback",
  refundedAmount: number | null
) {
  if (kind === "refund") {
    const returns = await prisma.return.aggregate({
      where: { orderId: order.id, status: "APPROVED", refundedAt: { not: null } },
      _sum: { refundAmount: true },
    });
    const byReturns = returns._sum.refundAmount || 0;
    if (byReturns > 0 && (refundedAmount == null || refundedAmount <= byReturns + 0.01)) return; // estorno das devoluções da própria loja
  }
  const what = kind === "chargeback" ? "uma CONTESTAÇÃO (chargeback)" : `um estorno${refundedAmount != null ? ` de R$ ${refundedAmount.toFixed(2)}` : ""} que não veio de uma devolução aprovada`;
  await flagOrderIssue(
    order.id,
    `${gatewayLabel} registrou ${what} com o pedido já ${order.status === "DELIVERED" ? "entregue" : order.status === "RETIRADO" ? "retirado" : "enviado"}. O pedido e o estoque não foram alterados — confira no ${gatewayLabel}.`
  );
}
