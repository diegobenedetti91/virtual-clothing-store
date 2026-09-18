import { prisma } from "@/lib/prisma";
import { restoreOrderStock } from "@/lib/stockUtils";

export async function refundPayment(orderNumber: string): Promise<{ success: boolean; message: string }> {
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
      await refundNuPay(order.paymentId);
    } else {
      return { success: false, message: "Gateway de pagamento desconhecido" };
    }

    // Mark as refunded and restore stock
    await prisma.order.update({
      where: { orderNumber },
      data: { refundedAt: new Date() },
    });

    await restoreOrderStock(order.items).catch(console.error);

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

async function refundNuPay(transactionId: string): Promise<void> {
  const settings = await prisma.companySettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const clientId = settings?.nuPayClientId;
  const clientSecret = settings?.nuPayClientSecret;

  if (!clientId || !clientSecret) {
    throw new Error("NuPay não configurado");
  }

  // Get NuPay token
  const tokenRes = await fetch("https://api.nupaybusiness.com.br/auth/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error("Erro ao autenticar com NuPay");
  }

  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;

  // Request refund
  const refundRes = await fetch(
    `https://api.nupaybusiness.com.br/v1/orders/${transactionId}/refunds`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount: 0 }), // 0 = full refund
    }
  );

  if (!refundRes.ok) {
    const err = await refundRes.text();
    throw new Error(`Erro ao reembolsar no NuPay: ${err}`);
  }

  console.log("[REFUND] NuPay refund successful for transaction:", transactionId);
}

export async function refundPartialPayment(orderNumber: string, refundAmount: number): Promise<{ success: boolean; message: string }> {
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

async function refundNuPayPartial(transactionId: string, amount: number): Promise<void> {
  const settings = await prisma.companySettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const clientId = settings?.nuPayClientId;
  const clientSecret = settings?.nuPayClientSecret;

  if (!clientId || !clientSecret) {
    throw new Error("NuPay não configurado");
  }

  const tokenRes = await fetch("https://api.nupaybusiness.com.br/auth/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error("Erro ao autenticar com NuPay");
  }

  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;

  const refundRes = await fetch(
    `https://api.nupaybusiness.com.br/v1/orders/${transactionId}/refunds`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount: Math.round(amount * 100) / 100 }),
    }
  );

  if (!refundRes.ok) {
    const err = await refundRes.text();
    throw new Error(`Erro ao reembolsar no NuPay: ${err}`);
  }

  console.log("[REFUND] NuPay partial refund successful for transaction:", transactionId);
}
