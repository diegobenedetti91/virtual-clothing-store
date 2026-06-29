import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    });

    if (!order) {
      console.warn(`Order not found: ${order_nsu}`);
      return NextResponse.json({ success: false, message: "Pedido não encontrado" }, { status: 400 });
    }

    // Se recebeu o webhook, significa que o pagamento foi aprovado
    // Atualizar status para CONFIRMED
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "CONFIRMED",
        // Armazenar dados da transação para futuras consultas/reembolsos
        notes: `${order.notes || ""}\n[Infinity Pay]\nTransaction: ${transaction_nsu}\nInvoice: ${invoice_slug}\nMethod: ${capture_method}\nReceipt: ${receipt_url}`.trim(),
      },
    });

    console.log(`✅ Order ${order_nsu} marked as CONFIRMED via Infinity Pay webhook`);

    // Respond with 200 OK in the format Infinity Pay expects
    return NextResponse.json({ success: true, message: null }, { status: 200 });
  } catch (error) {
    console.error("Infinity Pay webhook error:", error);
    // Return 400 Bad Request to trigger retry (Infinity Pay will retry)
    return NextResponse.json({ success: false, message: String(error) }, { status: 400 });
  }
}
