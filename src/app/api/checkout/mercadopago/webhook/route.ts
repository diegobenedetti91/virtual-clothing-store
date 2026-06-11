import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusEmail, sendOrderConfirmationEmail, sendNewOrderNotificationEmail } from "@/lib/email";
import { decrementOrderStock } from "@/lib/stockUtils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { type, data } = body;

    console.log("[MP WEBHOOK] Received webhook:", { type, paymentId: data?.id });

    if (type !== "payment" || !data?.id) {
      console.log("[MP WEBHOOK] Ignoring non-payment webhook");
      return NextResponse.json({ ok: true });
    }

    const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
    const accessToken = settings?.mercadoPagoAccessToken;
    if (!accessToken) {
      console.error("[MP WEBHOOK] MP Access token not configured");
      return NextResponse.json({ ok: true });
    }

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
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

  // Order was already created with PENDING status, just update it
  if (order && order.status !== newStatus) {
    console.log("[MP WEBHOOK] Updating order status:", { orderNumber, from: order.status, to: newStatus });

    // Store payment info for future refunds
    await prisma.order.update({
      where: { orderNumber },
      data: {
        status: newStatus,
        paymentGateway: "mercadopago",
        paymentId: payment.id,
      },
    });

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
