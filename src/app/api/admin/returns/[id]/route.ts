import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendReturnDecisionEmail, sendReturnLabelEmail } from "@/lib/email";
import { refundPartialPayment } from "@/lib/refundUtils";
import { restoreOrderStock } from "@/lib/stockUtils";
import { getCarrierTracking } from "@/lib/carrierTracking";

type ReturnedItem = { itemId: string; quantity: number };

// De qual status cada ação pode partir: só aprova depois do código de postagem enviado (mercadoria a caminho/recebida)
const ALLOWED_FROM: Record<string, string[]> = {
  SEND_TRACKING: ["PENDING", "AWAITING_RETURN"],
  APPROVED: ["AWAITING_RETURN"],
  REJECTED: ["PENDING", "AWAITING_RETURN"],
};

function parseReturnedItems(value: unknown): ReturnedItem[] {
  if (Array.isArray(value)) return value as ReturnedItem[];
  if (typeof value === "string") return JSON.parse(value);
  return [];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const returnData = await prisma.return.findUnique({
      where: { id },
      include: {
        order: {
          include: { items: { include: { product: true } } },
        },
        customer: true,
      },
    });

    if (!returnData) {
      return NextResponse.json({ error: "Devolução não encontrada" }, { status: 404 });
    }

    return NextResponse.json(returnData);
  } catch (error) {
    console.error("[admin/returns/[id]] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar devolução" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const returnData = await prisma.return.findUnique({
      where: { id },
      include: {
        order: { include: { items: true } },
        customer: true,
      },
    });

    if (!returnData) {
      return NextResponse.json({ error: "Devolução não encontrada" }, { status: 404 });
    }

    const settings = await prisma.companySettings.findFirst();
    const storeName = settings?.name || "Loja";

    if (body.action === "SEND_TRACKING") {
      return sendTrackingCode(returnData, body.trackingCode, storeName);
    }

    const { status, adminNotes, images } = body;

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    }

    if (!ALLOWED_FROM[status].includes(returnData.status)) {
      return NextResponse.json(
        {
          error: status === "APPROVED"
            ? "Só é possível aprovar depois de enviar o código de postagem ao cliente"
            : "Esta devolução já foi finalizada",
        },
        { status: 409 }
      );
    }

    const returnedItems = parseReturnedItems(returnData.returnedItems);

    // Recalcula pelo preço pago no pedido, ignorando o valor gravado na solicitação
    const refundAmount = Math.round(
      returnedItems.reduce((sum, ri) => {
        const orderItem = returnData.order.items.find((oi) => oi.id === ri.itemId);
        return sum + (orderItem ? orderItem.price * ri.quantity : 0);
      }, 0) * 100
    ) / 100;

    // Transição condicional ao status atual: um duplo clique não aprova (nem estorna) duas vezes
    const claimed = await prisma.return.updateMany({
      where: { id, status: { in: ALLOWED_FROM[status] } },
      data: {
        status,
        adminNotes: adminNotes || null,
        images: images && images.length > 0 ? JSON.stringify(images) : null,
        responseDate: new Date(),
        ...(status === "APPROVED" && { refundAmount }),
      },
    });

    if (claimed.count === 0) {
      return NextResponse.json({ error: "Esta devolução já foi processada" }, { status: 409 });
    }

    let refund: { success: boolean; message: string } | null = null;

    // Se aprovar, restaurar estoque e fazer estorno de pagamento
    if (status === "APPROVED") {
      const itemsToRestore = returnedItems
        .map((returnedItem) => {
          const orderItem = returnData.order.items.find((oi) => oi.id === returnedItem.itemId);
          if (!orderItem) return null;
          return {
            productId: orderItem.productId,
            quantity: returnedItem.quantity, // Quantidade devolvida, não total
            size: orderItem.size,
            color: orderItem.color,
            selectedAttributes: orderItem.selectedAttributes,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      if (itemsToRestore.length > 0) {
        await restoreOrderStock(itemsToRestore).catch(console.error);
      }

      const gateway = returnData.order.paymentGateway;
      if (refundAmount > 0 && (gateway === "mercadopago" || gateway === "nupay")) {
        refund = await refundPartialPayment(returnData.order.orderNumber, refundAmount);

        if (refund.success) {
          await prisma.return.update({
            where: { id },
            data: { refundedAt: new Date() },
          }).catch(console.error);
        } else {
          console.warn("[admin/returns] Refund failed:", refund.message);
        }
      } else if (refundAmount > 0 && gateway === "infinitypay") {
        // InfinityPay has no refund API: same treatment as WhatsApp orders (manual refund)
        await prisma.return.update({
          where: { id },
          data: { refundedAt: new Date() },
        }).catch(console.error);
        refund = {
          success: true,
          message: `Estorno automático indisponível para InfinityPay: faça o estorno de R$ ${refundAmount.toFixed(2)} pelo painel da InfinityPay.`,
        };
      } else if (refundAmount > 0 && (!gateway || gateway === "whatsapp")) {
        // Para WhatsApp ou sem gateway, apenas marcar como refundado (refund é manual)
        await prisma.return.update({
          where: { id },
          data: { refundedAt: new Date() },
        }).catch(console.error);
        refund = {
          success: true,
          message: `Pedido sem gateway de pagamento: faça o estorno de R$ ${refundAmount.toFixed(2)} manualmente ao cliente.`,
        };
      }

      // Calcular returnStatus baseado em devoluções aprovadas
      const allReturns = await prisma.return.findMany({
        where: { orderId: returnData.order.id, status: "APPROVED" },
      });

      const totalOrderQuantity = returnData.order.items.reduce((sum, item) => sum + item.quantity, 0);
      const totalReturnedQuantity = allReturns.reduce(
        (sum, ret) => sum + parseReturnedItems(ret.returnedItems).reduce((s, item) => s + item.quantity, 0),
        0
      );

      let returnStatus = null;
      if (totalReturnedQuantity > 0) {
        returnStatus = totalReturnedQuantity >= totalOrderQuantity ? "FULL_RETURN" : "PARTIAL_RETURN";
      }

      await prisma.order.update({
        where: { id: returnData.order.id },
        data: { returnStatus },
      }).catch(console.error);
    }

    // Enviar email ao cliente (non-blocking)
    if (returnData.customer.email) {
      sendReturnDecisionEmail({
        to: returnData.customer.email,
        customerName: returnData.customer.name,
        orderNumber: returnData.order.orderNumber,
        approved: status === "APPROVED",
        storeName,
        adminNotes,
        images: images && images.length > 0 ? images : undefined,
        refundAmount: status === "APPROVED" ? refundAmount : undefined,
      }).catch(console.error);
    }

    const updated = await prisma.return.findUnique({ where: { id } });
    return NextResponse.json({ ...updated, refund });
  } catch (error) {
    console.error("[admin/returns/[id]] PATCH error:", error);
    return NextResponse.json({ error: "Erro ao atualizar devolução" }, { status: 500 });
  }
}

async function sendTrackingCode(
  returnData: {
    id: string;
    status: string;
    order: { orderNumber: string; customerName: string; customerEmail: string | null };
    customer: { email: string; name: string };
  },
  rawCode: unknown,
  storeName: string
) {
  const trackingCode = typeof rawCode === "string" ? rawCode.replace(/\s+/g, "").toUpperCase() : "";
  if (!/^[A-Z0-9-]{8,40}$/.test(trackingCode)) {
    return NextResponse.json({ error: "Código de rastreio inválido" }, { status: 400 });
  }

  const claimed = await prisma.return.updateMany({
    where: { id: returnData.id, status: { in: ALLOWED_FROM.SEND_TRACKING } },
    data: { status: "AWAITING_RETURN", trackingCode, labelSentAt: new Date() },
  });

  if (claimed.count === 0) {
    return NextResponse.json({ error: "Esta devolução já foi finalizada" }, { status: 409 });
  }

  const to = returnData.customer.email || returnData.order.customerEmail;
  if (to) {
    sendReturnLabelEmail({
      to,
      customerName: returnData.customer.name || returnData.order.customerName,
      orderNumber: returnData.order.orderNumber,
      trackingCode,
      trackingUrl: getCarrierTracking(trackingCode).url,
      storeName,
    }).catch(console.error);
  }

  const updated = await prisma.return.findUnique({ where: { id: returnData.id } });
  return NextResponse.json(updated);
}
