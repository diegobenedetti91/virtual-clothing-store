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

async function refundMercadoPago(paymentId: string): Promise<void> {
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

async function refundNuPay(pspReferenceId: string, amount: number): Promise<void> {
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
