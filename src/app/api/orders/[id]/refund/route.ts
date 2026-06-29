import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { restoreOrderStock } from "@/lib/stockUtils";

interface RefundPayload {
  amount?: number;
  reason?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: RefundPayload = await req.json();
    const { amount, reason } = body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    if (order.status !== "CONFIRMED" && order.status !== "PAID") {
      return NextResponse.json(
        { error: "Apenas pedidos confirmados/pagos podem ser reembolsados" },
        { status: 400 }
      );
    }

    const settings = await prisma.companySettings.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    if (!settings) {
      return NextResponse.json(
        { error: "Configurações da loja não encontradas" },
        { status: 500 }
      );
    }

    const refundAmount = amount || order.total;

    // Process refund based on payment method or gateway
    try {
      const paymentMethod = order.paymentMethod?.toLowerCase() || "";
      const paymentGateway = (order as any).paymentGateway?.toLowerCase() || "";

      if ((paymentMethod.includes("mercado") || paymentGateway === "mercadopago") && settings.mercadoPagoAccessToken) {
        await processMercadoPagoRefund(
          order,
          refundAmount,
          reason || "Reembolso solicitado",
          settings.mercadoPagoAccessToken
        );
      } else if ((paymentMethod.includes("nupay") || paymentGateway === "nupay") && settings.nuPayClientId && settings.nuPayClientSecret) {
        await processNuPayRefund(
          order,
          refundAmount,
          reason || "Reembolso solicitado",
          settings.nuPayClientId,
          settings.nuPayClientSecret
        );
      } else if ((paymentMethod.includes("infinity") || paymentGateway === "infinitypay") && settings.infinityPayApiKey) {
        await processInfinityPayRefund(
          order,
          refundAmount,
          reason || "Reembolso solicitado",
          settings.infinityPayApiKey
        );
      } else {
        return NextResponse.json(
          { error: `Reembolso não suportado para ${order.paymentMethod || paymentGateway}. Gateway: ${paymentGateway}, Método: ${paymentMethod}` },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error("Refund processing error:", error);
      return NextResponse.json(
        { error: "Erro ao processar reembolso" },
        { status: 500 }
      );
    }

    // Restore stock before updating status
    if (order.items?.length > 0 && (order.status === "CONFIRMED" || order.status === "PAID")) {
      console.log("[REFUND] Restoring stock for order:", order.orderNumber);
      const itemsForStock = order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        selectedAttributes: item.selectedAttributes,
      }));
      await restoreOrderStock(itemsForStock).catch(console.error);
    }

    // Update order status
    await prisma.order.update({
      where: { id },
      data: {
        status: "REFUNDED",
        notes: `${order.notes || ""}\nReembolso de R$ ${(refundAmount / 100).toFixed(2)}: ${reason || "Solicitado"}`.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Reembolso processado com sucesso",
      amount: refundAmount,
    });
  } catch (error) {
    console.error("Refund route error:", error);
    return NextResponse.json(
      { error: "Erro ao processar reembolso" },
      { status: 500 }
    );
  }
}

async function processMercadoPagoRefund(
  order: any,
  amount: number,
  reason: string,
  accessToken: string
) {
  // Extract payment ID from order notes or transaction info
  // This is a placeholder - você precisa armazenar o payment_id do MP
  console.log("Processing Mercado Pago refund:", order.orderNumber, amount);
  // await fetch(`https://api.mercadopago.com/v1/payments/{id}/refunds`, {
  //   method: "POST",
  //   headers: { Authorization: `Bearer ${accessToken}` },
  //   body: JSON.stringify({ amount: amount / 100 }),
  // });
}

async function processNuPayRefund(
  order: any,
  amount: number,
  reason: string,
  clientId: string,
  clientSecret: string
) {
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
    throw new Error("Failed to authenticate with NuPay");
  }

  const { access_token } = await tokenRes.json();

  // Extract transaction ID from order notes
  // This is a placeholder - você precisa armazenar o transaction_id do NuPay
  console.log("Processing NuPay refund:", order.orderNumber, amount);
  // await fetch(`https://api.nupaybusiness.com.br/v1/transactions/{id}/refund`, {
  //   method: "POST",
  //   headers: { Authorization: `Bearer ${access_token}` },
  //   body: JSON.stringify({ amount: amount / 100 }),
  // });
}

async function processInfinityPayRefund(
  order: any,
  amount: number,
  reason: string,
  apiKey: string
) {
  // Extract transaction_nsu and invoice_slug from order notes
  const transactionMatch = order.notes?.match(/Transaction: ([\w-]+)/);
  const invoiceMatch = order.notes?.match(/Invoice: ([\w-]+)/);

  const transactionId = transactionMatch?.[1];
  const invoiceSlug = invoiceMatch?.[1];

  if (!transactionId || !invoiceSlug) {
    throw new Error("Transaction ID ou Invoice Slug não encontrado no pedido");
  }

  // TODO: Implementar reembolso via Infinity Pay
  // A documentação fornecida não menciona endpoint de reembolso
  // Você precisa verificar com Infinity Pay:
  // 1. Qual é o endpoint de reembolso?
  // 2. Como se autentica?
  // 3. Quais parâmetros são necessários?

  console.log("Infinity Pay refund requested:", {
    transactionId,
    invoiceSlug,
    amount,
    reason,
  });

  throw new Error("Reembolso via Infinity Pay ainda não implementado. Contate o suporte.");
}
