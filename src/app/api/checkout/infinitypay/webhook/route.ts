import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusEmail, sendOrderConfirmationEmail, sendNewOrderNotificationEmail } from "@/lib/email";
import { commitOrderStock } from "@/lib/stockUtils";
import { createAutomaticShipment } from "@/lib/shipmentUtils";
import { trackServer } from "@/lib/analyticsServer";
import { sendMetaPurchase } from "@/lib/metaCapi";
import { integrarPedidoBling } from "@/lib/blingService";

// Exempt from all protections - webhook from external service
export const dynamic = "force-dynamic";

// InfinityPay webhooks are not signed. Their docs say to confirm every notice with
// /payment_check, which only returns paid=true when order_nsu, transaction_nsu and
// slug all belong to the same paid invoice.
async function confirmWithInfinityPay(
  handle: string,
  orderNsu: string,
  transactionNsu: unknown,
  slug: unknown,
  expectedCents: number
): Promise<boolean> {
  if (typeof transactionNsu !== "string" || typeof slug !== "string") return false;
  try {
    const res = await fetch("https://api.checkout.infinitepay.io/payment_check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, order_nsu: orderNsu, transaction_nsu: transactionNsu, slug }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const check = await res.json();
    const paidCents = Number(check?.paid_amount ?? check?.amount ?? 0);
    return check?.success === true && check?.paid === true && paidCents >= expectedCents - 1;
  } catch (err) {
    console.error("[IP WEBHOOK] payment_check failed:", err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("[IP WEBHOOK] Received for order_nsu:", body?.order_nsu);

    // Webhook payload from Infinity Pay documentation
    const { order_nsu, transaction_nsu, invoice_slug, capture_method, amount, paid_amount, installments, receipt_url } = body;

    console.log("order_nsu:", order_nsu);
    console.log("transaction_nsu:", transaction_nsu);
    console.log("invoice_slug:", invoice_slug);

    if (!order_nsu) {
      console.warn("❌ Webhook inválido - order_nsu ausente");
      return NextResponse.json({ success: false, message: "order_nsu ausente" }, { status: 400 });
    }

    // Find order by orderNumber (which is our order_nsu)
    const order = await prisma.order.findUnique({
      where: { orderNumber: order_nsu },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      console.warn(`Order not found: ${order_nsu}`);
      return NextResponse.json({ success: false, message: "Pedido não encontrado" }, { status: 400 });
    }

    // Don't revert cancelled orders
    if (order.status === "CANCELLED") {
      console.log("[IP WEBHOOK] Order is already cancelled, ignoring webhook");
      return NextResponse.json({ success: true, message: null }, { status: 200 });
    }

    // Confirmar com a InfinityPay antes de marcar como pago (o webhook não é assinado)
    if (order.status !== "CONFIRMED") {
      const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
      const handle = settings?.infinityPayHandle;
      const paid =
        !!handle &&
        (await confirmWithInfinityPay(handle, order.orderNumber, transaction_nsu, invoice_slug, Math.round(order.total * 100)));
      if (!paid) {
        console.warn("[IP WEBHOOK] Payment not confirmed by payment_check for order", order.orderNumber);
        return NextResponse.json({ success: false, message: "Pagamento não confirmado" }, { status: 400 });
      }
    }

    // Pagamento confirmado pela InfinityPay: atualizar status para CONFIRMED
    if (order.status !== "CONFIRMED") {
      console.log("[IP WEBHOOK] Updating order status:", { orderNumber: order_nsu, from: order.status, to: "CONFIRMED" });

      // Armazenar dados da transação para futuras consultas/reembolsos
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "CONFIRMED",
          paymentGateway: "infinitypay",
          paymentId: transaction_nsu || invoice_slug,
          paymentMethod: "Infinity Pay",
          notes: `${order.notes || ""}\n[Infinity Pay]\nTransaction: ${transaction_nsu}\nInvoice: ${invoice_slug}\nMethod: ${capture_method}\nReceipt: ${receipt_url}`.trim(),
        },
      });

      console.log(`✅ Order ${order_nsu} marked as CONFIRMED via Infinity Pay webhook`);

      // Decrement stock when payment is confirmed
      console.log("[IP WEBHOOK] Decrementing stock for order:", order_nsu);
      await commitOrderStock(order.id).catch(console.error);

      // Get settings for Bling integration
      const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });

      // Integrate with Bling if enabled
      if (settings?.blingAtivo) {
        try {
          console.log("[IP WEBHOOK] Integrating order with Bling:", order_nsu);
          const result = await integrarPedidoBling(order.id);
          if (result.success) {
            console.log("[IP WEBHOOK] Order successfully integrated with Bling");
          } else {
            console.error("[IP WEBHOOK] Failed to integrate with Bling:", result.error);
          }
        } catch (err) {
          console.error("[IP WEBHOOK] Error integrating with Bling:", err);
        }
      }

      // Create shipment automatically on Melhor Envio
      try {
        console.log("[IP WEBHOOK] Creating automatic shipment for order:", order_nsu);
        await createAutomaticShipment(order.id);
      } catch (err) {
        console.error("[IP WEBHOOK] Failed to create shipment:", err);
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
        console.error("[IP WEBHOOK] Failed to track order:", err);
      }

      // Meta Conversions API: Purchase (deduplicated with the browser pixel by event_id)
      await sendMetaPurchase(order.id).catch((err) => console.error("[IP WEBHOOK] Meta purchase failed:", err));

      // Send emails
      const storeName = settings?.name || "Minha Loja";
      const emailTarget = order.customerEmail;

      if (emailTarget) {
        console.log("[IP WEBHOOK] Sending confirmation email to customer:", emailTarget);
        sendOrderConfirmationEmail({
          to: emailTarget,
          customerName: order.customerName,
          orderNumber: order.orderNumber,
          storeName,
          items: order.items.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.price })),
          total: order.total,
          isGateway: true,
        }).catch((err) => console.error("[IP WEBHOOK] Failed to send customer email:", err));
      }

      // Send notification email to store owner
      const adminEmail = process.env.SMTP_USER;
      if (adminEmail) {
        console.log("[IP WEBHOOK] Sending notification email to admin:", adminEmail);
        sendNewOrderNotificationEmail({
          to: adminEmail,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          storeName,
          items: order.items.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.price })),
          total: order.total,
        }).catch((err) => console.error("[IP WEBHOOK] Failed to send admin email:", err));
      }
    }

    // Respond with 200 OK in the format Infinity Pay expects
    return NextResponse.json({ success: true, message: null }, { status: 200 });
  } catch (error) {
    console.error("Infinity Pay webhook error:", error);
    // Return 400 Bad Request to trigger retry (Infinity Pay will retry)
    return NextResponse.json({ success: false, message: "Erro ao processar webhook" }, { status: 400 });
  }
}
