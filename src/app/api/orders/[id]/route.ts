import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusEmail, sendShippingEmail } from "@/lib/email";
import { commitOrderStock } from "@/lib/stockUtils";
import { cancelOrder } from "@/lib/cancelOrder";
import { auth } from "@/lib/auth";
import { getCustomerFromRequest } from "@/lib/customerAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Admin, or the customer who placed the order
  const customer = getCustomerFromRequest(req);
  const isOwner =
    !!customer &&
    (order.customerId === customer.id ||
      (!!order.customerEmail && order.customerEmail.toLowerCase() === customer.email.toLowerCase()));
  const isAdmin = !!(await auth());
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isAdmin) {
    // Ocorrências internas (instruções de estorno etc.) são só para a loja
    const { opsAlert: _a, opsAlertAt: _b, ...publicOrder } = order;
    return NextResponse.json(publicOrder);
  }
  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { status, cancelReason, trackingCode, shippingProof } = body;

  // Dono resolveu a ocorrência do pedido (estorno manual feito, estoque ajustado…)
  if (body.resolveAlert === true) {
    const order = await prisma.order.findUnique({ where: { id }, select: { opsAlert: true, notes: true } });
    if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    const stamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const updated = await prisma.order.update({
      where: { id },
      data: {
        opsAlert: null,
        opsAlertAt: null,
        // Histórico: a ocorrência resolvida fica registrada nas observações
        notes: order.opsAlert ? `${order.notes ? `${order.notes}\n` : ""}[Ocorrência resolvida em ${stamp} por ${session.user?.email || "admin"}] ${order.opsAlert}` : order.notes,
      },
    });
    return NextResponse.json(updated);
  }

  const current = await prisma.order.findUnique({
    where: { id },
    select: { status: true, items: { select: { productId: true, quantity: true, size: true, color: true, selectedAttributes: true } } },
  });

  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    PENDING:                 ["CONFIRMED", "CANCELLED"],
    CONFIRMED:               ["SHIPPED", "PRONTO_PARA_RETIRADA", "CANCELLED"],
    // Depois de sair da loja, cancelar = devolução (estorno proporcional e só as peças que voltaram)
    SHIPPED:                 ["DELIVERED"],
    PRONTO_PARA_RETIRADA:    ["RETIRADO", "CANCELLED"],
    RETIRADO:                [],
    DELIVERED:               [],
    CANCELLED:               [],
  };

  if (!current || !ALLOWED_TRANSITIONS[current.status]?.includes(status)) {
    return NextResponse.json({ error: "Transição de status não permitida" }, { status: 400 });
  }

  // Cancelar: estorna primeiro e só cancela se o estorno der certo (lib/cancelOrder)
  if (status === "CANCELLED") {
    const result = await cancelOrder(id, { reason: cancelReason ?? null, by: "admin" });
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
    const cancelled = await prisma.order.findUnique({ where: { id }, include: { items: { include: { product: true } }, customer: true } });
    const to = cancelled?.customer?.email || cancelled?.customerEmail;
    if (cancelled && to && !result.already) {
      const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { name: true } });
      sendOrderStatusEmail({
        to,
        customerName: cancelled.customer?.name || cancelled.customerName,
        orderNumber: cancelled.orderNumber,
        newStatus: "CANCELLED",
        storeName: settings?.name || "Minha Loja",
        cancelReason: cancelReason ?? undefined,
      }).catch(console.error);
    }
    return NextResponse.json({ ...cancelled, message: result.message, manualRefund: result.manualRefund ?? false });
  }

  const updateData: Record<string, unknown> = { status };
  // Início do prazo de devolução (7 dias a partir do recebimento)
  if (status === "DELIVERED" || status === "RETIRADO") updateData.deliveredAt = new Date();
  if (cancelReason !== undefined) updateData.cancelReason = cancelReason;
  if (trackingCode !== undefined) updateData.trackingCode = trackingCode;
  if (shippingProof !== undefined) updateData.shippingProof = shippingProof;

  const order = await prisma.order.update({
    where: { id },
    data: updateData,
    include: { items: { include: { product: true } }, customer: true },
  });

  // Admin confirming an order paid outside the gateways (e.g. WhatsApp): take stock now
  if (status === "CONFIRMED") {
    await commitOrderStock(id).catch(console.error);
  }

  const emailTarget = order.customer?.email || order.customerEmail;
  const recipientName = order.customer?.name || order.customerName;

  if (emailTarget) {
    const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { name: true, address: true, phone: true } });
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
    } else if (status === "PRONTO_PARA_RETIRADA") {
      // Send ready for pickup notification
      const pickupMessage = `
Seu pedido ${order.orderNumber} está pronto para retirada!

Endereço: ${settings?.address || "A definir"}
${settings?.phone ? `Telefone: ${settings.phone}` : ""}

Compareça em nosso endereço para fazer a retirada do seu pedido.
`;
      sendOrderStatusEmail({
        to: emailTarget,
        customerName: recipientName,
        orderNumber: order.orderNumber,
        newStatus: status,
        storeName,
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
