import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusEmail, sendOrderConfirmationEmail, sendNewOrderNotificationEmail } from "@/lib/email";
import { commitOrderStock, releaseOrderStock } from "@/lib/stockUtils";
import { createAutomaticShipment } from "@/lib/shipmentUtils";
import { trackServer } from "@/lib/analyticsServer";
import { sendMetaPurchase } from "@/lib/metaCapi";
import { integrarPedidoBling } from "@/lib/blingService";
import { MP_TRANSPARENT_LABEL } from "@/lib/mercadoPagoTransparent";
import { extractMpPaymentDetails } from "@/lib/mercadoPagoPayment";

// Exempt from all protections - webhook from external service
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  console.log("[MP WEBHOOK] ========== RECEIVED WEBHOOK ==========");
  try {
    const body = await req.json().catch(() => ({}));
    const { type, data } = body;

    console.log("[MP WEBHOOK] Type:", type);
    console.log("[MP WEBHOOK] Data:", data);

    // Ignore merchant_order webhooks - we only process payment webhooks
    if (type === "topic_merchant_order_wh") {
      console.log("[MP WEBHOOK] Ignoring merchant_order webhook - only processing payment webhooks");
      return NextResponse.json({ ok: true });
    }

    if (type !== "payment" || !body.data?.id) {
      console.log("[MP WEBHOOK] Ignoring non-payment webhook");
      return NextResponse.json({ ok: true });
    }

    const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
    const accessToken = settings?.mercadoPagoAccessToken;
    if (!accessToken) {
      console.error("[MP WEBHOOK] MP Access token not configured");
      return NextResponse.json({ ok: true });
    }

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${body.data.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!paymentRes.ok) {
      const err = await paymentRes.text();
      console.error("[MP WEBHOOK] Failed to fetch payment from MP:", err);
      return NextResponse.json({ ok: true });
    }

    const payment = await paymentRes.json();
    const orderNumber = payment.external_reference;
    console.log("[MP WEBHOOK] Payment status:", { paymentStatus: payment.status, orderNumber });

    if (!orderNumber) {
      console.error("[MP WEBHOOK] No external_reference in payment");
      return NextResponse.json({ ok: true });
    }

  const statusMap: Record<string, string> = {
    approved: "CONFIRMED",
    pending: "PENDING",
    in_process: "PENDING",
    authorized: "PENDING",
    rejected: "CANCELLED",
    cancelled: "CANCELLED",
    // Full refund or chargeback (also when done directly in the Mercado Pago panel)
    refunded: "CANCELLED",
    charged_back: "CANCELLED",
  };

  const newStatus = statusMap[payment.status];
  if (!newStatus) {
    // e.g. in_mediation (dispute opened): keep the order as it is
    console.log("[MP WEBHOOK] Ignoring payment status:", payment.status);
    return NextResponse.json({ ok: true });
  }

  // Check if order exists
  let order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { include: { product: true } } },
  });

  // Don't revert cancelled orders
  if (order?.status === "CANCELLED") {
    console.log("[MP WEBHOOK] Order is already cancelled, ignoring webhook");
    return NextResponse.json({ ok: true });
  }

  // A paid/shipped order never goes back to PENDING
  if (order && newStatus === "PENDING" && order.status !== "PENDING") {
    console.log("[MP WEBHOOK] Ignoring PENDING for order in status", order.status);
    return NextResponse.json({ ok: true });
  }

  // In-site card payments: a refused attempt is handled (and the order discarded)
  // by /api/checkout/mercadopago/transparent, so the buyer can retry without
  // receiving a "cancelled order" e-mail.
  if (order && payment.status === "rejected" && order.status === "PENDING" && order.paymentMethod === MP_TRANSPARENT_LABEL) {
    console.log("[MP WEBHOOK] Ignoring rejected in-site payment attempt for", orderNumber);
    return NextResponse.json({ ok: true });
  }

  // Já estava confirmado (aviso repetido): só completa taxa/forma de pagamento se ainda não tiver
  if (order && order.status === newStatus && newStatus === "CONFIRMED" && (order as { paymentNetAmount?: number | null }).paymentNetAmount == null) {
    const details = extractMpPaymentDetails(payment);
    await prisma.order
      .update({
        where: { orderNumber },
        data: { paymentFee: details.fee, paymentNetAmount: details.net, paymentType: details.paymentType, paymentInstallments: details.installments },
      })
      .catch(console.error);
  }

  // Order was already created with PENDING status, just update it
  if (order && order.status !== newStatus) {
    console.log("[MP WEBHOOK] Updating order status:", { orderNumber, from: order.status, to: newStatus });

    // Store payment info for future refunds
    try {
      const updateData: any = {
        status: newStatus,
        paymentGateway: "mercadopago",
        paymentId: String(payment.id),
        paymentMethod: order.paymentMethod === MP_TRANSPARENT_LABEL ? MP_TRANSPARENT_LABEL : "Mercado Pago",
      };

      // Taxa real (fee_details), líquido e forma de pagamento — o MP não tem campo "fee"
      if (newStatus === "CONFIRMED") {
        const details = extractMpPaymentDetails(payment);
        updateData.paymentFee = details.fee;
        updateData.paymentNetAmount = details.net;
        updateData.paymentType = details.paymentType;
        updateData.paymentInstallments = details.installments;
      }

      await prisma.order.update({
        where: { orderNumber },
        data: updateData,
      });
      console.log("[MP WEBHOOK] Order updated successfully", { paymentFee: updateData.paymentFee });
    } catch (updateErr) {
      console.error("[MP WEBHOOK] Error updating order:", updateErr);
      // Continue anyway, at least update status
      await prisma.order.update({
        where: { orderNumber },
        data: { status: newStatus },
      });
    }

    // Payment cancelled/refunded: give back stock if it had been taken
    if (newStatus === "CANCELLED") {
      await releaseOrderStock(order.id).catch(console.error);
    }

    // Decrement stock when payment is confirmed
    if (newStatus === "CONFIRMED") {
      console.log("[MP WEBHOOK] Decrementing stock for order:", orderNumber);
      await commitOrderStock(order.id).catch(console.error);

      // Integrate with Bling if enabled
      if (settings?.blingAtivo) {
        try {
          console.log("[MP WEBHOOK] Integrating order with Bling:", orderNumber);
          const result = await integrarPedidoBling(order.id);
          if (result.success) {
            console.log("[MP WEBHOOK] Order successfully integrated with Bling");
          } else {
            console.error("[MP WEBHOOK] Failed to integrate with Bling:", result.error);
          }
        } catch (err) {
          console.error("[MP WEBHOOK] Error integrating with Bling:", err);
        }
      }

      // Create shipment automatically on Melhor Envio
      try {
        console.log("[MP WEBHOOK] Creating automatic shipment for order:", orderNumber);
        await createAutomaticShipment(order.id);
      } catch (err) {
        console.error("[MP WEBHOOK] Failed to create shipment:", err);
        // Don't fail the whole webhook, just log the error
      }

      // Track order completion
      try {
        await trackServer("ORDER_COMPLETE", {
          orderId: order.id,
          customerId: order.customerId,
          value: order.total,
        });
      } catch (err) {
        console.error("[MP WEBHOOK] Failed to track order:", err);
      }

      // Meta Conversions API: Purchase (deduplicated with the browser pixel by event_id)
      await sendMetaPurchase(order.id).catch((err) => console.error("[MP WEBHOOK] Meta purchase failed:", err));
    }

    const emailTarget = order.customerEmail;
    if (emailTarget || newStatus === "CONFIRMED") {
      const storeName = settings?.name || "Minha Loja";
      if (newStatus === "CONFIRMED") {
        console.log("[MP WEBHOOK] Sending confirmation email to customer:", emailTarget);
        if (emailTarget) {
          sendOrderConfirmationEmail({
            to: emailTarget,
            customerName: order.customerName,
            orderNumber: order.orderNumber,
            storeName,
            items: order.items.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.price })),
            total: order.total,
            isGateway: true,
          }).catch((err) => console.error("[MP WEBHOOK] Failed to send customer email:", err));
        }

        // Send notification email to store owner (uses SMTP_USER which is the store email)
        const adminEmail = process.env.SMTP_USER;
        if (adminEmail) {
          console.log("[MP WEBHOOK] Sending notification email to admin:", adminEmail);
          sendNewOrderNotificationEmail({
            to: adminEmail,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            customerPhone: order.customerPhone,
            storeName,
            items: order.items.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.price })),
            total: order.total,
          }).catch((err) => console.error("[MP WEBHOOK] Failed to send admin email:", err));
        }
      } else if (newStatus !== "PENDING" && emailTarget) {
        sendOrderStatusEmail({
          to: emailTarget,
          customerName: order.customerName,
          orderNumber: order.orderNumber,
          newStatus,
          storeName,
        }).catch(console.error);
      }
    }
  }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[MP WEBHOOK] ========== ERROR ==========");
    console.error("[MP WEBHOOK] Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("[MP WEBHOOK] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[MP WEBHOOK] Error stack:", error instanceof Error ? error.stack : "No stack");
    console.error("========================================");
    return NextResponse.json({ ok: true }, { status: 500 });
  }
}

// MP sends GET to validate the webhook URL
export async function GET() {
  return NextResponse.json({ ok: true });
}
