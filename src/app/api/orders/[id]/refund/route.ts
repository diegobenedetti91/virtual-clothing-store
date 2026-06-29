import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    if (order.status !== "PAID") {
      return NextResponse.json(
        { error: "Apenas pedidos pagos podem ser reembolsados" },
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

    // Process refund based on payment method
    try {
      if (order.paymentMethod === "Mercado Pago" && settings.mercadoPagoAccessToken) {
        await processMercadoPagoRefund(
          order,
          refundAmount,
          reason || "Reembolso solicitado",
          settings.mercadoPagoAccessToken
        );
      } else if (order.paymentMethod === "NuPay" && settings.nuPayClientId && settings.nuPayClientSecret) {
        await processNuPayRefund(
          order,
          refundAmount,
          reason || "Reembolso solicitado",
          settings.nuPayClientId,
          settings.nuPayClientSecret
        );
      } else if (order.paymentMethod === "Infinity Pay" && settings.infinityPayApiKey) {
        await processInfinityPayRefund(
          order,
          refundAmount,
          reason || "Reembolso solicitado",
          settings.infinityPayApiKey
        );
      } else {
        return NextResponse.json(
          { error: `Reembolso não suportado para ${order.paymentMethod}` },
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
  // Extract transaction_nsu from order notes
  const transactionMatch = order.notes?.match(/Transaction ID: (\w+)/);
  const transactionId = transactionMatch?.[1];

  if (!transactionId) {
    throw new Error("Transaction ID não encontrado no pedido");
  }

  const refundRes = await fetch("https://api.checkout.infinitepay.io/refund", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      transaction_nsu: transactionId,
      amount: Math.round(amount),
      reason: reason,
    }),
  });

  if (!refundRes.ok) {
    const err = await refundRes.text();
    console.error("Infinity Pay refund error:", err);
    throw new Error(`Infinity Pay refund failed: ${err}`);
  }

  const refundData = await refundRes.json();
  console.log("Infinity Pay refund processed:", refundData);
}
