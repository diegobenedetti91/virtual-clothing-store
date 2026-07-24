import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusEmail, sendOrderConfirmationEmail, sendNewOrderNotificationEmail } from "@/lib/email";
import { decrementOrderStock } from "@/lib/stockUtils";
import { createAutomaticShipment } from "@/lib/shipmentUtils";
import { track } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  console.log("[MP WEBHOOK] ========== RECEIVED WEBHOOK ==========");
  try {
    const body = await req.json().catch(() => ({}));
    const { type, data } = body;

    console.log("[MP WEBHOOK] Full body:", JSON.stringify(body, null, 2));
    console.log("[MP WEBHOOK] Type:", type);
    console.log("[MP WEBHOOK] Data:", data);

    // Handle merchant_order webhook (order closed/updated)
    if (type === "topic_merchant_order_wh") {
      // Only process when order is closed (payment confirmed)
      if (data?.status !== "closed") {
        console.log("[MP WEBHOOK] Merchant order not closed yet, ignoring");
        return NextResponse.json({ ok: true });
      }

      console.log("[MP WEBHOOK] Processing merchant order closure");

      // Find the most recent PENDING order (which should be the one just paid)
      try {
        const merchantOrderId = body.id;
        const pendingOrder = await prisma.order.findFirst({
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
        });

        if (!pendingOrder) {
          console.log("[MP WEBHOOK] No pending order found");
          return NextResponse.json({ ok: true });
        }

        console.log("[MP WEBHOOK] Found pending order:", pendingOrder.orderNumber);

        // Update order to CONFIRMED (payment received)
        const updatedOrder = await prisma.order.update({
          where: { id: pendingOrder.id },
          data: {
            status: "CONFIRMED",
            paymentGateway: "mercadopago",
            paymentId: String(merchantOrderId),
            paymentMethod: "Mercado Pago",
          },
          include: { items: { include: { product: true } }, customer: true },
        });

        console.log("[MP WEBHOOK] Order confirmed:", updatedOrder.orderNumber);

        // Decrement stock
        const itemsForStock = updatedOrder.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
          selectedAttributes: item.selectedAttributes,
        }));
        await decrementOrderStock(itemsForStock).catch(console.error);

        // Create shipment automatically (commented for now - endpoint needs to be verified)
        // try {
        //   console.log("[MP WEBHOOK] Creating automatic shipment");
        //   await createAutomaticShipment(updatedOrder.id);
        // } catch (err) {
        //   console.error("[MP WEBHOOK] Failed to create shipment:", err);
        // }

        // Track order completion
        try {
          await track("ORDER_COMPLETE", {
            orderId: updatedOrder.id,
            customerId: updatedOrder.customerId,
            value: updatedOrder.total,
          });
        } catch (err) {
          console.error("[MP WEBHOOK] Failed to track order:", err);
        }

        // Send confirmation email
        const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
        const storeName = settings?.name || "Minha Loja";
        const emailTarget = updatedOrder.customer?.email || updatedOrder.customerEmail;

        if (emailTarget) {
          sendOrderConfirmationEmail({
            to: emailTarget,
            customerName: updatedOrder.customerName,
            orderNumber: updatedOrder.orderNumber,
            storeName,
            items: updatedOrder.items.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.price })),
            total: updatedOrder.total,
            isGateway: true,
          }).catch((err) => console.error("[MP WEBHOOK] Failed to send email:", err));
        }

        console.log("[MP WEBHOOK] Order processing complete");
        return NextResponse.json({ ok: true });
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
