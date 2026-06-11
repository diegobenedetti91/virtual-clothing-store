import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusEmail, sendShippingEmail } from "@/lib/email";
import { restoreOrderStock } from "@/lib/stockUtils";
import { refundPayment } from "@/lib/refundUtils";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status, cancelReason, trackingCode, shippingProof } = await req.json();

  const current = await prisma.order.findUnique({
    where: { id },
    select: { status: true, items: { select: { productId: true, quantity: true, size: true, color: true, selectedAttributes: true } } },
  });

  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    PENDING:   ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["SHIPPED",   "CANCELLED"],
    SHIPPED:   ["DELIVERED", "CANCELLED"],
    DELIVERED: ["CANCELLED"],
    CANCELLED: [],
  };

  if (!current || !ALLOWED_TRANSITIONS[current.status]?.includes(status)) {
    return NextResponse.json({ error: "Transição de status não permitida" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { status };
  if (cancelReason !== undefined) updateData.cancelReason = cancelReason;
  if (trackingCode !== undefined) updateData.trackingCode = trackingCode;
  if (shippingProof !== undefined) updateData.shippingProof = shippingProof;

  const order = await prisma.order.update({
    where: { id },
    data: updateData,
    include: { items: { include: { product: true } }, customer: true },
  });

  if (status === "CANCELLED" && current && current.status !== "CANCELLED") {
    // Restore stock
    await restoreOrderStock(current.items).catch(console.error);

    // Process refund if payment was confirmed
    const fullOrder = await prisma.order.findUnique({ where: { id } });
    if (fullOrder?.paymentGateway && fullOrder?.paymentId && fullOrder?.status === "CONFIRMED") {
      console.log("[ADMIN CANCEL] Processing refund for order:", order.orderNumber);
      const refundResult = await refundPayment(order.orderNumber);
      if (!refundResult.success) {
        console.error("[ADMIN CANCEL] Refund failed:", refundResult.message);
      }
    }
  }

  const emailTarget = order.customer?.email || order.customerEmail;
  const recipientName = order.customer?.name || order.customerName;

  if (emailTarget) {
    const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { name: true } });
    const storeName = settings?.name || "Minha Loja";

    if (status === "SHIPPED") {
      sendShippingEmail({
        to: emailTarget,
        customerName: recipientName,
        orderNumber: order.orderNumber,
        storeName,
        trackingCode: trackingCode || undefined,
        shippingProofUrl: shippingProof || undefined,
      }).catch(console.error);
    } else {
      sendOrderStatusEmail({
        to: emailTarget,
        customerName: recipientName,
        orderNumber: order.orderNumber,
        newStatus: status,
        storeName,
        cancelReason: status === "CANCELLED" ? cancelReason : undefined,
      }).catch(console.error);
    }
  }

  return NextResponse.json(order);
}
