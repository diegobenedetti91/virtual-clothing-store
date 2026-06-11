import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusEmail, sendOrderConfirmationEmail, sendNewOrderNotificationEmail } from "@/lib/email";
import { decrementOrderStock } from "@/lib/stockUtils";

// NuPay status → internal status mapping
const statusMap: Record<string, string> = {
  PAID: "CONFIRMED",
  APPROVED: "CONFIRMED",
  AUTHORIZED: "PENDING",
  WAITING_PAYMENT: "PENDING",
  WAITING_PAYMENT_METHOD: "PENDING",
  PENDING: "PENDING",
  CANCELLED: "CANCELLED",
  EXPIRED: "CANCELLED",
  REFUNDED: "CANCELLED",
  CHARGEBACK: "CANCELLED",
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // NuPay sends the order reference and status in the webhook payload
  const orderNumber: string | undefined =
    body.externalReference ?? body.external_reference ?? body.orderId;
  const nuPayStatus: string | undefined =
    body.status ?? body.paymentStatus;

  if (!orderNumber || !nuPayStatus) {
    return NextResponse.json({ ok: true });
  }

  const newStatus = statusMap[nuPayStatus.toUpperCase()] ?? "PENDING";
  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });

  // Order was already created with PENDING status, just update it
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { include: { product: true } } },
  });

  if (order && order.status !== newStatus) {
    console.log("[NUPAY WEBHOOK] Updating order status:", { orderNumber, from: order.status, to: newStatus });

    await prisma.order.update({ where: { orderNumber }, data: { status: newStatus } });

    // Decrement stock when payment is confirmed
    if (newStatus === "CONFIRMED") {
      console.log("[NUPAY WEBHOOK] Decrementing stock for order:", orderNumber);
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
        console.log("[NUPAY WEBHOOK] Sending confirmation email to customer:", emailTarget);
        if (emailTarget) {
          sendOrderConfirmationEmail({
            to: emailTarget,
            customerName: order.customerName,
            orderNumber: order.orderNumber,
            storeName,
            items: order.items.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.price })),
            total: order.total,
            isGateway: true,
          }).catch((err) => console.error("[NUPAY WEBHOOK] Failed to send customer email:", err));
        }

        // Send notification email to store owner (uses SMTP_USER which is the store email)
        const adminEmail = process.env.SMTP_USER;
        if (adminEmail) {
          console.log("[NUPAY WEBHOOK] Sending notification email to admin:", adminEmail);
          sendNewOrderNotificationEmail({
            to: adminEmail,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            customerPhone: order.customerPhone,
            storeName,
            items: order.items.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.price })),
            total: order.total,
          }).catch((err) => console.error("[NUPAY WEBHOOK] Failed to send admin email:", err));
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
}

// NuPay may send GET to validate the webhook URL
export async function GET() {
  return NextResponse.json({ ok: true });
}
