import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusEmail, sendOrderConfirmationEmail, sendNewOrderNotificationEmail } from "@/lib/email";
import { decrementOrderStock } from "@/lib/stockUtils";
import { track } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("\n📥 [Infinity Pay Webhook] Recebido:");
    console.log(JSON.stringify(body, null, 2));

    // Webhook payload from Infinity Pay documentation
    const { order_nsu, transaction_nsu, invoice_slug, capture_method, amount, paid_amount, installments, receipt_url } = body;

    console.log("order_nsu:", order_nsu);
    console.log("transaction_nsu:", transaction_nsu);
    console.log("invoice_slug:", invoice_slug);

    if (!order_nsu) {
      console.warn("❌ Webhook inválido - order_nsu ausente");
      console.warn("Body completo:", JSON.stringify(body, null, 2));
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

    // Se recebeu o webhook, significa que o pagamento foi aprovado
    // Atualizar status para CONFIRMED
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
      const itemsForStock = order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        selectedAttributes: item.selectedAttributes,
      }));
      await decrementOrderStock(itemsForStock).catch(console.error);

      // Track order completion
      try {
        await track("ORDER_COMPLETE", {
          orderId: order.id,
          customerId: order.customerId,
          value: order.total,
        });
      } catch (err) {
        console.error("[IP WEBHOOK] Failed to track order:", err);
      }

      // Send emails
      const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
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
    return NextResponse.json({ success: false, message: String(error) }, { status: 400 });
  }
}
