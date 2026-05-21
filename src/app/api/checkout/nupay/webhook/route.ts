import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusEmail, sendOrderConfirmationEmail } from "@/lib/email";
import { restoreOrderStock } from "@/lib/stockUtils";

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
  // Field names confirmed once you receive the first webhook; adjust if needed
  const orderNumber: string | undefined =
    body.externalReference ?? body.external_reference ?? body.orderId;
  const nuPayStatus: string | undefined =
    body.status ?? body.paymentStatus;

  if (!orderNumber || !nuPayStatus) {
    return NextResponse.json({ ok: true });
  }

  const newStatus = statusMap[nuPayStatus.toUpperCase()] ?? "PENDING";

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { include: { product: true } } },
  });
  if (!order) return NextResponse.json({ ok: true });

  if (order.status !== newStatus) {
    await prisma.order.update({ where: { orderNumber }, data: { status: newStatus } });

    if (newStatus === "CANCELLED") {
      await restoreOrderStock(order.items).catch(console.error);
    }

    const emailTarget = order.customerEmail;
    if (emailTarget) {
      const storeName = settings?.name || "Minha Loja";
      if (newStatus === "CONFIRMED") {
        sendOrderConfirmationEmail({
          to: emailTarget,
          customerName: order.customerName,
          orderNumber: order.orderNumber,
          storeName,
          items: order.items.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.price })),
          total: order.total,
          isGateway: true,
        }).catch(console.error);
      } else if (newStatus !== "PENDING") {
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
