import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refundPayment } from "@/lib/refundUtils";
import { sendOrderStatusEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const { orderNumber, reason } = await req.json();

    if (!orderNumber) {
      return NextResponse.json({ error: "Número do pedido é obrigatório" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { customer: true, items: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    // Verify authorization (admin via NextAuth session or customer owner)
    const isAdmin = !!session?.user?.email; // NextAuth session = admin
    const isOwner = session?.user?.id === order.customerId;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    // Customer can only cancel CONFIRMED orders
    if (!isAdmin && order.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Pedido não pode ser cancelado neste status. Entre em contato com a loja." },
        { status: 400 }
      );
    }

    // Admin can cancel most statuses except DELIVERED
    if (isAdmin && order.status === "DELIVERED") {
      return NextResponse.json(
        { error: "Pedidos entregues não podem ser cancelados" },
        { status: 400 }
      );
    }

    // Refund payment if order was confirmed
    let refundMessage = "";
    if (order.status === "CONFIRMED" && order.paymentGateway && order.paymentId) {
      const refundResult = await refundPayment(orderNumber);
      if (refundResult.success) {
        refundMessage = ` Reembolso de R$ ${order.total.toFixed(2)} será processado em breve.`;
      } else {
        console.error("[CANCEL] Refund failed:", refundResult.message);
        refundMessage = ` Erro ao processar reembolso: ${refundResult.message}`;
      }
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { orderNumber },
      data: {
        status: "CANCELLED",
        cancelReason: reason || null,
      },
      include: { items: { include: { product: true } } },
    });

    // Send notification email to customer
    if (order.customerEmail) {
      const settings = await prisma.companySettings.findFirst({
        orderBy: { updatedAt: "desc" },
      });

      sendOrderStatusEmail({
        to: order.customerEmail,
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        newStatus: "CANCELLED",
        storeName: settings?.name || "Minha Loja",
        cancelReason: reason,
      }).catch(console.error);
    }

    return NextResponse.json(
      {
        success: true,
        message: `Pedido cancelado com sucesso.${refundMessage}`,
        order: updatedOrder,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[CANCEL] Error:", error);
    return NextResponse.json(
      { error: "Erro ao cancelar pedido" },
      { status: 500 }
    );
  }
}
