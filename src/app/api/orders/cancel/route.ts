import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCustomerFromRequest } from "@/lib/customerAuth";
import { prisma } from "@/lib/prisma";
import { cancelOrder } from "@/lib/cancelOrder";
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
      include: { items: { include: { product: { select: { name: true } } } } },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    // Verify authorization (admin via NextAuth session or customer owner)
    const isAdmin = !!session?.user?.email;
    const customer = getCustomerFromRequest(req);
    const isOwner =
      !!customer &&
      (order.customerId === customer.id ||
        (!!order.customerEmail && order.customerEmail.toLowerCase() === customer.email.toLowerCase()));
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    // Estorna primeiro; se falhar, não cancela (regras em lib/cancelOrder)
    const result = await cancelOrder(order.id, { reason: reason || null, by: isAdmin ? "admin" : "customer" });
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id }, include: { items: { include: { product: true } } } });
    // Mensagem do dono (instruções de estorno) não vai para o cliente
    const refundMessage = isAdmin
      ? result.message.replace(/^Pedido cancelado\./, "")
      : order.status === "CONFIRMED"
        ? result.manualRefund
          ? " A loja vai fazer o estorno do valor pago e te avisar."
          : " O estorno foi solicitado e aparece na sua fatura/conta conforme o prazo do meio de pagamento."
        : "";

    // Send notification email to customer
    if (order.customerEmail && !result.already) {
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
        manualRefund: isAdmin ? (result.manualRefund ?? false) : false,
        order: isAdmin || !updatedOrder ? updatedOrder : (({ opsAlert: _a, opsAlertAt: _b, ...o }) => o)(updatedOrder),
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
