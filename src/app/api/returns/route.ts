import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromRequest } from "@/lib/customerAuth";
import { sendReturnRequestNotificationEmail, sendReturnRequestConfirmationEmail } from "@/lib/email";

const RETURN_DAYS = 7;

export async function POST(req: NextRequest) {
  try {
    const customer = getCustomerFromRequest(req);
    if (!customer) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { orderId, reason, itemIds, returnAmount } = await req.json();

    if (!orderId || !reason) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order || order.customerId !== customer.id) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    // Verificar se está dentro do prazo de 7 dias
    const createdAt = new Date(order.createdAt);
    const daysDiff = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff > RETURN_DAYS) {
      return NextResponse.json(
        { error: `Prazo de devolução expirado. O prazo é de ${RETURN_DAYS} dias.` },
        { status: 400 }
      );
    }

    // Validar que não está tentando devolver mais do que já foi devolvido
    const returnedItems: Record<string, number> = {};
    const approvedReturns = await prisma.return.findMany({
      where: { orderId, status: "APPROVED" },
    });

    for (const ret of approvedReturns) {
      if (ret.returnedItems && typeof ret.returnedItems === "object") {
        for (const item of ret.returnedItems as any[]) {
          returnedItems[item.itemId] = (returnedItems[item.itemId] || 0) + item.quantity;
        }
      }
    }

    // Validar cada item sendo devolvido
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId },
    });

    for (const selection of itemIds || []) {
      const orderItem = orderItems.find((i) => i.id === selection.itemId);
      if (!orderItem) {
        return NextResponse.json(
          { error: "Item não encontrado no pedido" },
          { status: 400 }
        );
      }

      const alreadyReturned = returnedItems[selection.itemId] || 0;
      const canReturn = orderItem.quantity - alreadyReturned;

      if (selection.quantity > canReturn) {
        return NextResponse.json(
          { error: `Não pode devolver mais de ${canReturn} unidade(s) desse item` },
          { status: 400 }
        );
      }
    }

    // Criar solicitação de devolução
    const newReturn = await prisma.return.create({
      data: {
        orderId,
        customerId: customer.id,
        reason,
        status: "PENDING",
        returnedItems: itemIds || [],
        refundAmount: returnAmount || 0,
      },
    });

    // Buscar settings para pegar dados da loja
    const settings = await prisma.companySettings.findFirst();
    const storeName = settings?.name || "Loja";
    const adminEmail = process.env.SMTP_USER;

    // Enviar emails (non-blocking)
    if (adminEmail) {
      sendReturnRequestNotificationEmail({
        to: adminEmail,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        orderNumber: order.orderNumber,
        reason,
        storeName,
      }).catch(console.error);
    }

    if (order.customerEmail) {
      sendReturnRequestConfirmationEmail({
        to: order.customerEmail,
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        storeName,
      }).catch(console.error);
    }

    return NextResponse.json(newReturn);
  } catch (error) {
    console.error("[returns] POST error:", error);
    return NextResponse.json({ error: "Erro ao criar devolução" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const customer = getCustomerFromRequest(req);
    if (!customer) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const returns = await prisma.return.findMany({
      where: { customerId: customer.id },
      include: { order: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(returns);
  } catch (error) {
    console.error("[returns] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar devoluções" }, { status: 500 });
  }
}
