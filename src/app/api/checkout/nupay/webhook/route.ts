import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getNuPayConfig, getNuPayPaymentStatus, mapNuPayStatus } from "@/lib/nupay";
import { sendOrderStatusEmail, sendOrderConfirmationEmail, sendNewOrderNotificationEmail } from "@/lib/email";
import { commitOrderStock, releaseOrderStock } from "@/lib/stockUtils";
import { createAutomaticShipment } from "@/lib/shipmentUtils";
import { trackServer } from "@/lib/analyticsServer";
import { sendMetaPurchase } from "@/lib/metaCapi";
import { integrarPedidoBling } from "@/lib/blingService";

// Exempt from all protections - webhook from external service
export const dynamic = "force-dynamic";

// NuPay notifications carry only identifiers (pspReferenceId, referenceId) and are
// not signed. The real status is always read back from the NuPay API, so a forged
// call can't mark an order as paid.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const pspReferenceId: string | undefined = typeof body?.pspReferenceId === "string" ? body.pspReferenceId : undefined;
  if (!pspReferenceId) {
    return NextResponse.json({ ok: true });
  }

  const config = await getNuPayConfig();
  if (!config) {
    console.error("[NUPAY WEBHOOK] NuPay not configured");
    return NextResponse.json({ ok: true });
  }

  const order = await prisma.order.findFirst({
    where: { paymentGateway: "nupay", paymentId: pspReferenceId },
    include: { items: { include: { product: true } } },
  });
  if (!order) {
    console.warn("[NUPAY WEBHOOK] No order for payment", pspReferenceId);
    return NextResponse.json({ ok: true });
  }
  const orderNumber = order.orderNumber;

  const remote = await getNuPayPaymentStatus(config, pspReferenceId);
  if (!remote) {
    // Let NuPay retry the notification later
    return NextResponse.json({ error: "Status unavailable" }, { status: 502 });
  }

  const newStatus = mapNuPayStatus(remote.status);
  if (!newStatus) {
    console.log("[NUPAY WEBHOOK] Ignoring payment status:", remote.status);
    return NextResponse.json({ ok: true });
  }

  // Don't revert cancelled orders
  if (order.status === "CANCELLED") {
    console.log("[NUPAY WEBHOOK] Order is already cancelled, ignoring webhook");
    return NextResponse.json({ ok: true });
  }

  // A paid/shipped order never goes back to PENDING
  if (newStatus === "PENDING" && order.status !== "PENDING") {
    return NextResponse.json({ ok: true });
  }

  // Paid amount must cover the order
  if (newStatus === "CONFIRMED" && remote.amount !== undefined && remote.amount + 0.01 < order.total) {
    console.error("[NUPAY WEBHOOK] Paid amount lower than order total", { orderNumber, paid: remote.amount, total: order.total });
    return NextResponse.json({ ok: true });
  }

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });

  if (order.status !== newStatus) {
    console.log("[NUPAY WEBHOOK] Updating order status:", { orderNumber, from: order.status, to: newStatus });
    // Conditional transition: two simultaneous notifications can't both process the order
    const claimed = await prisma.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: newStatus },
    });
    if (claimed.count === 0) {
      console.log("[NUPAY WEBHOOK] Order changed concurrently, skipping", orderNumber);
      return NextResponse.json({ ok: true });
    }

    // Payment cancelled/refunded: give back stock if it had been taken
    if (newStatus === "CANCELLED") {
      await releaseOrderStock(order.id).catch(console.error);
    }

    // Decrement stock when payment is confirmed
    if (newStatus === "CONFIRMED") {
      console.log("[NUPAY WEBHOOK] Decrementing stock for order:", orderNumber);
      await commitOrderStock(order.id).catch(console.error);

      // Integrate with Bling if enabled
      if (settings?.blingAtivo) {
        try {
          console.log("[NUPAY WEBHOOK] Integrating order with Bling:", orderNumber);
          const result = await integrarPedidoBling(order.id);
          if (result.success) {
            console.log("[NUPAY WEBHOOK] Order successfully integrated with Bling");
          } else {
            console.error("[NUPAY WEBHOOK] Failed to integrate with Bling:", result.error);
          }
        } catch (err) {
          console.error("[NUPAY WEBHOOK] Error integrating with Bling:", err);
        }
      }

      // Create shipment automatically on Melhor Envio
      try {
        console.log("[NUPAY WEBHOOK] Creating automatic shipment for order:", orderNumber);
        await createAutomaticShipment(order.id);
      } catch (err) {
        console.error("[NUPAY WEBHOOK] Failed to create shipment:", err);
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
        console.error("[NUPAY WEBHOOK] Failed to track order:", err);
      }

      // Meta Conversions API: Purchase (deduplicated with the browser pixel by event_id)
      await sendMetaPurchase(order.id).catch((err) => console.error("[NUPAY WEBHOOK] Meta purchase failed:", err));
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
