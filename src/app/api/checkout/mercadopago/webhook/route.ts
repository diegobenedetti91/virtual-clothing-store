import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusEmail, sendOrderConfirmationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { type, data } = body;

  if (type !== "payment" || !data?.id) {
    return NextResponse.json({ ok: true });
  }

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "asc" } });
  const accessToken = settings?.mercadoPagoAccessToken;
  if (!accessToken) return NextResponse.json({ ok: true });

  const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!paymentRes.ok) return NextResponse.json({ ok: true });

  const payment = await paymentRes.json();
  const orderNumber = payment.external_reference;
  if (!orderNumber) return NextResponse.json({ ok: true });

  const statusMap: Record<string, string> = {
    approved: "CONFIRMED",
    pending: "PENDING",
    in_process: "PENDING",
    rejected: "CANCELLED",
    cancelled: "CANCELLED",
  };

  const newStatus = statusMap[payment.status] || "PENDING";

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { include: { product: true } } },
  });
  if (!order) return NextResponse.json({ ok: true });

  if (order.status !== newStatus) {
    await prisma.order.update({ where: { orderNumber }, data: { status: newStatus } });

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

// MP sends GET to validate the webhook URL
export async function GET() {
  return NextResponse.json({ ok: true });
}
