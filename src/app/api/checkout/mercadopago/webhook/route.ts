import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusEmail, sendOrderConfirmationEmail } from "@/lib/email";
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

  // If order doesn't exist and payment is approved, create it
  if (!order && newStatus === "CONFIRMED") {
    console.log("[MP WEBHOOK] Creating order for payment:", orderNumber);
    console.log("[MP WEBHOOK] Payment metadata:", JSON.stringify(payment.metadata));

    const metadata = payment.metadata || {};
    let itemsData = metadata.items ? JSON.parse(metadata.items as string) : [];

    if (!itemsData.length) {
      console.error("[MP WEBHOOK] No items in metadata:", metadata);
      console.error("[MP WEBHOOK] Full payment object:", JSON.stringify(payment));
      return NextResponse.json({ ok: true });
    }

    // Fetch product info to get prices
    const productIds = itemsData.map((i: { productId: string }) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const fullAddress = metadata.address && metadata.city
      ? `${metadata.address}, ${metadata.city}${metadata.state ? `/${metadata.state}` : ""}`
      : null;

    // Create order in transaction with stock decrement
    order = await prisma.$transaction(async (tx) => {
      // Decrement stock (convert selectedAttributes to string if needed)
      const itemsForStock = itemsData.map((item: { productId: string; quantity: number; size?: string; color?: string; selectedAttributes?: string }) => ({
        productId: item.productId,
        quantity: item.quantity,
        size: item.size || null,
        color: item.color || null,
        selectedAttributes: item.selectedAttributes || null,
      }));
      await decrementOrderStock(itemsForStock).catch(console.error);

      // Create order
      return tx.order.create({
        data: {
          orderNumber,
          customerName: metadata.customerName,
          customerEmail: metadata.customerEmail || null,
          customerPhone: metadata.customerPhone,
          address: fullAddress,
          city: metadata.city || null,
          state: metadata.state || null,
          zipCode: metadata.zipCode || null,
          notes: metadata.notes || null,
          customerId: metadata.customerId || null,
          subtotal: metadata.subtotal || 0,
          total: metadata.subtotal || 0,
          status: "CONFIRMED",
          items: {
            create: itemsData.map((item: { productId: string; quantity: number; size?: string; color?: string; selectedAttributes?: string }) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: productMap.get(item.productId)?.price || 0,
              size: item.size || null,
              color: item.color || null,
              selectedAttributes: item.selectedAttributes || null,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });
    });

    console.log("[MP WEBHOOK] Order created successfully:", orderNumber);

    const emailTarget = order.customerEmail;
    if (emailTarget) {
      const storeName = settings?.name || "Minha Loja";
      console.log("[MP WEBHOOK] Sending confirmation email to:", emailTarget);
      sendOrderConfirmationEmail({
        to: emailTarget,
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        storeName,
        items: order.items.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.price })),
        total: order.total,
        isGateway: true,
      }).catch((err) => console.error("[MP WEBHOOK] Failed to send email:", err));
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
  } catch (error) {
    console.error("[MP WEBHOOK] Error processing webhook:", error);
    return NextResponse.json({ ok: true });
  }
}

// MP sends GET to validate the webhook URL
export async function GET() {
  return NextResponse.json({ ok: true });
}
