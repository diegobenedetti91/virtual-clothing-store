import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refundPayment } from "@/lib/refundUtils";
import { sendOrderStatusEmail } from "@/lib/email";
import { restoreOrderStock } from "@/lib/stockUtils";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const { orderNumber, reason } = await req.json();

    if (!orderNumber) {
      return NextResponse.json({ error: "Número do pedido é obrigatório" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { items: { include: { product: { select: { name: true } } } } },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    // Verificar se há devoluções aprovadas
    const approvedReturns = await prisma.return.findMany({
      where: { orderId: order.id, status: "APPROVED" },
    });

    if (approvedReturns.length > 0) {
      return NextResponse.json(
        {
          error: "Pedido com devolução aprovada não pode ser cancelado. Verifique o status das devoluções.",
          hasApprovedReturns: true
        },
        { status: 400 }
      );
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

    // Determine cancel reason
    let cancelReason = reason || null;
    if (!isAdmin && !cancelReason) {
      cancelReason = "Cancelado pelo cliente";
    }

    // Restore stock if order was confirmed/paid
    if ((order.status === "CONFIRMED" || order.status === "PAID") && order.items?.length > 0) {
      console.log("[CANCEL] Restoring stock for order:", orderNumber);
      console.log("[CANCEL] Order status before restore:", order.status);
      console.log("[CANCEL] Items to restore:", JSON.stringify(order.items.map(item => ({
        productId: item.productId,
        productName: item.product?.name,
        quantity: item.quantity,
      }))));

      const itemsForStock = order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        selectedAttributes: item.selectedAttributes,
      }));

      await restoreOrderStock(itemsForStock).catch((err) => {
        console.error("[CANCEL] Error restoring stock:", err);
        throw err;
      });

      console.log("[CANCEL] ✓ Stock restored successfully for order:", orderNumber);
    } else if (!order.items?.length) {
      console.warn("[CANCEL] Order has no items to restore");
    } else {
      console.warn("[CANCEL] Order status is", order.status, "- stock restore not applicable");
    }

    // Update order status
    console.log("[CANCEL] Updating order status to CANCELLED:", { orderNumber, currentStatus: order.status });
    const updatedOrder = await prisma.order.update({
      where: { orderNumber },
      data: {
        status: "CANCELLED",
        cancelReason,
      },
      include: { items: { include: { product: true } } },
    });
    console.log("[CANCEL] Order updated successfully:", { orderNumber, newStatus: updatedOrder.status });

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
    console.error("[CANCEL] Full error details:", JSON.stringify(error, null, 2));
    return NextResponse.json(
      { error: `Erro ao cancelar pedido: ${String(error)}` },
      { status: 500 }
    );
  }
}
