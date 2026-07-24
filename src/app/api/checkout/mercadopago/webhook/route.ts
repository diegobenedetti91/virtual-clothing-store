import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusEmail, sendOrderConfirmationEmail, sendNewOrderNotificationEmail } from "@/lib/email";
import { decrementOrderStock } from "@/lib/stockUtils";
import { createAutomaticShipment } from "@/lib/shipmentUtils";
import { track } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { type, data } = body;

    console.log("[MP WEBHOOK] ========== RECEIVED WEBHOOK ==========");
    console.log("[MP WEBHOOK] Full body:", JSON.stringify(body, null, 2));
    console.log("[MP WEBHOOK] Type:", type);
    console.log("[MP WEBHOOK] Data:", data);
    console.log("========================================");

    // Handle merchant_order webhook (order closed/updated)
    if (type === "topic_merchant_order_wh") {
      const merchantOrderId = body.id;
      if (!merchantOrderId) {
        console.log("[MP WEBHOOK] No merchant order ID");
        return NextResponse.json({ ok: true });
      }

      const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
      const accessToken = settings?.mercadoPagoAccessToken;
      if (!accessToken) {
        console.error("[MP WEBHOOK] MP Access token not configured");
        return NextResponse.json({ ok: true });
      }

      // Fetch merchant order to get payment info
      try {
        const orderRes = await fetch(`https://api.mercadopago.com/v1/merchant_orders/${merchantOrderId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!orderRes.ok) {
          console.error("[MP WEBHOOK] Failed to fetch merchant order from MP");
          return NextResponse.json({ ok: true });
        }

        const merchantOrder = await orderRes.json();
        console.log("[MP WEBHOOK] Merchant Order Status:", { status: merchantOrder.status, orderNumber: merchantOrder.external_reference });

        // Only process if order is closed (payment confirmed)
        if (merchantOrder.status !== "closed") {
          console.log("[MP WEBHOOK] Merchant order not closed yet, ignoring");
          return NextResponse.json({ ok: true });
        }

        // Get first payment from merchant order
        const payment = merchantOrder.payments?.[0];
        if (!payment) {
          console.error("[MP WEBHOOK] No payment found in merchant order");
          return NextResponse.json({ ok: true });
        }

        // Fetch payment details
        const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!paymentRes.ok) {
          console.error("[MP WEBHOOK] Failed to fetch payment");
          return NextResponse.json({ ok: true });
        }

        const paymentData = await paymentRes.json();
        const orderNumber = merchantOrder.external_reference;

        console.log("[MP WEBHOOK] Processing payment:", { orderId: orderNumber, paymentStatus: paymentData.status });

        if (!orderNumber) {
          console.error("[MP WEBHOOK] No external_reference in merchant order");
          return NextResponse.json({ ok: true });
        }

        // Continue with payment processing using paymentData
        body.type = "payment";
        body.data = { id: paymentData.id };
      } catch (err) {
        console.error("[MP WEBHOOK] Error processing merchant order:", err);
        return NextResponse.json({ ok: true });
      }
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
    rejected: "CANCELLED",
    cancelled: "CANCELLED",
  };

  const newStatus = statusMap[payment.status] || "PENDING";

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

  // Order was already created with PENDING status, just update it
  if (order && order.status !== newStatus) {
    console.log("[MP WEBHOOK] Updating order status:", { orderNumber, from: order.status, to: newStatus });

    // Store payment info for future refunds
    try {
      const updateData: any = {
        status: newStatus,
        paymentGateway: "mercadopago",
        paymentId: String(payment.id),
        paymentMethod: "Mercado Pago",
      };

      // Save fee and payment method when confirmed
      if (newStatus === "CONFIRMED" && payment.fee) {
        updateData.paymentFee = payment.fee;
      }

      await prisma.order.update({
        where: { orderNumber },
        data: updateData,
      });
      console.log("[MP WEBHOOK] Order updated successfully", { paymentFee: payment.fee });
    } catch (updateErr) {
      console.error("[MP WEBHOOK] Error updating order:", updateErr);
      // Continue anyway, at least update status
      await prisma.order.update({
        where: { orderNumber },
        data: { status: newStatus },
      });
    }

    // Decrement stock when payment is confirmed
    if (newStatus === "CONFIRMED") {
      console.log("[MP WEBHOOK] Decrementing stock for order:", orderNumber);
      const itemsForStock = order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        selectedAttributes: item.selectedAttributes,
      }));
      await decrementOrderStock(itemsForStock).catch(console.error);

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
        await track("ORDER_COMPLETE", {
          orderId: order.id,
          customerId: order.customerId,
          value: order.total,
        });
      } catch (err) {
        console.error("[MP WEBHOOK] Failed to track order:", err);
      }
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
    console.error("[MP WEBHOOK] Error processing webhook:", error);
    return NextResponse.json({ ok: true });
  }
}

// MP sends GET to validate the webhook URL
export async function GET() {
  return NextResponse.json({ ok: true });
}
