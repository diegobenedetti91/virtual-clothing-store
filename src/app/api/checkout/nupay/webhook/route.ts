import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusEmail, sendOrderConfirmationEmail } from "@/lib/email";
import { decrementOrderStock } from "@/lib/stockUtils";
import { getPendingOrder, removePendingOrder } from "@/lib/pendingOrderCache";

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

  // Check if order exists
  let order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { include: { product: true } } },
  });

  // If order doesn't exist and payment is confirmed, create it
  if (!order && newStatus === "CONFIRMED") {
    const pendingData = getPendingOrder(orderNumber);
    if (!pendingData) return NextResponse.json({ ok: true });

    // Fetch product info to get prices
    const productIds = pendingData.items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const fullAddress = pendingData.address && pendingData.city
      ? `${pendingData.address}, ${pendingData.city}${pendingData.state ? `/${pendingData.state}` : ""}`
      : null;

    // Create order in transaction with stock decrement
    order = await prisma.$transaction(async (tx) => {
      // Decrement stock (convert selectedAttributes to string if needed)
      const itemsForStock = pendingData.items.map((item) => ({
        ...item,
        selectedAttributes: item.selectedAttributes
          ? JSON.stringify(item.selectedAttributes)
          : null,
      }));
      await decrementOrderStock(itemsForStock).catch(console.error);

      // Create order
      return tx.order.create({
        data: {
          orderNumber,
          customerName: pendingData.customerName,
          customerEmail: pendingData.customerEmail,
          customerPhone: pendingData.customerPhone,
          address: fullAddress,
          city: pendingData.city,
          state: pendingData.state,
          zipCode: pendingData.zipCode,
          notes: pendingData.notes,
          customerId: pendingData.customerId,
          subtotal: pendingData.subtotal,
          total: pendingData.subtotal,
          status: "CONFIRMED",
          items: {
            create: pendingData.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: productMap.get(item.productId)?.price || 0,
              size: item.size || null,
              color: item.color || null,
              selectedAttributes: item.selectedAttributes
                ? JSON.stringify(item.selectedAttributes)
                : null,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });
    });

    removePendingOrder(orderNumber);

    const emailTarget = order.customerEmail;
    if (emailTarget) {
      const storeName = settings?.name || "Minha Loja";
      sendOrderConfirmationEmail({
        to: emailTarget,
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        storeName,
        items: order.items.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.price })),
        total: order.total,
        isGateway: true,
      }).catch(console.error);
    }
  } else if (order && order.status !== newStatus) {
    // Order exists, just update status
    await prisma.order.update({ where: { orderNumber }, data: { status: newStatus } });

    const emailTarget = order.customerEmail;
    if (emailTarget) {
      const storeName = settings?.name || "Minha Loja";
      if (newStatus !== "PENDING") {
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
