import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Webhook payload example from Infinity Pay documentation
    const { order_nsu, transaction_nsu, status, paid_amount, installments } = body;

    if (!order_nsu || !status) {
      console.warn("Webhook inválido do Infinity Pay:", body);
      return NextResponse.json({ success: false }, { status: 400 });
    }

    // Find order by orderNumber (which is our order_nsu)
    const order = await prisma.order.findUnique({
      where: { orderNumber: order_nsu },
    });

    if (!order) {
      console.warn(`Order not found: ${order_nsu}`);
      return NextResponse.json({ success: false }, { status: 400 });
    }

    // Update order status based on Infinity Pay status
    let orderStatus = "PENDING";

    if (status === "approved" || status === "paid") {
      orderStatus = "PAID";
    } else if (status === "declined" || status === "failed") {
      orderStatus = "FAILED";
    } else if (status === "pending") {
      orderStatus = "PENDING";
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: orderStatus,
        // Opcionalmente armazenar dados da transação
        ...(transaction_nsu && { notes: `${order.notes || ""}\nTransaction ID: ${transaction_nsu}`.trim() }),
      },
    });

    console.log(`Order ${order_nsu} updated to status: ${orderStatus}`);

    // Respond quickly with 200 OK
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Infinity Pay webhook error:", error);
    // Return 400 Bad Request to trigger retry (Infinity Pay will retry)
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}
