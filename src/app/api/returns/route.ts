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

    // Verificar se já existe uma solicitação de devolução
    const existingReturn = await prisma.return.findFirst({
      where: { orderId, status: { in: ["PENDING", "APPROVED"] } },
    });

    if (existingReturn) {
      return NextResponse.json(
        { error: "Já existe uma solicitação de devolução para este pedido" },
        { status: 400 }
      );
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
