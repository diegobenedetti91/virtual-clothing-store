import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendReturnDecisionEmail, sendReturnLabelEmail } from "@/lib/email";
import { refundPartialPayment } from "@/lib/refundUtils";
import { computeReturnRefund } from "@/lib/returnRefund";
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
    if (body.action === "RETRY_REFUND") return retryRefund(id);
    if (body.action === "MARK_REFUNDED") return markRefunded(id);

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

    // Pelo que o cliente pagou pelas peças (cupom, Pix e crédito rateados), descontando devoluções anteriores
    const split = await computeReturnRefund(returnData.order.id, returnedItems, id);
    const refundAmount = split.money;
    const refundCredit = split.credit;

    // Transição condicional ao status atual: um duplo clique não aprova (nem estorna) duas vezes
    const claimed = await prisma.return.updateMany({
      where: { id, status: { in: ALLOWED_FROM[status] } },
      data: {
        status,
        adminNotes: adminNotes || null,
        images: images && images.length > 0 ? JSON.stringify(images) : null,
        responseDate: new Date(),
        ...(status === "APPROVED" && { refundAmount, refundCredit, refundError: null }),
      },
    });

    if (claimed.count === 0) {
      return NextResponse.json({ error: "Esta devolução já foi processada" }, { status: 409 });
    }

    let refund: { success: boolean; message: string; pending?: boolean } | null = null;

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
        await restoreOrderStock(itemsToRestore)
          .then(async (warnings) => {
            if (warnings.length) await flagOrder(returnData.order.id, `Devolução aprovada, mas parte do estoque não foi reposta — ajuste à mão: ${warnings.join("; ")}`);
          })
          .catch(async (e) => {
          console.error("[admin/returns] Falha ao repor estoque:", e);
          await flagOrder(returnData.order.id, `Devolução aprovada, mas o estoque NÃO foi reposto automaticamente (${returnedItems.length} item/itens). Ajuste o estoque à mão.`);
        });
      }

      // Parte paga com crédito de cashback volta como crédito na conta
      if (refundCredit > 0 && returnData.order.customerId) {
        await prisma.creditAdjustment
          .create({ data: { customerId: returnData.order.customerId, amount: refundCredit, reason: `Devolução do pedido ${returnData.order.orderNumber} (crédito usado na compra)`, createdBy: "sistema" } })
          .catch((e) => console.error("[admin/returns] Falha ao devolver crédito:", e));
      }

      refund = await doRefund(id, returnData.order, refundAmount);
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

const MANUAL_PREFIX = "Estorno manual:";

async function flagOrder(orderId: string, msg: string) {
  await prisma.order.update({ where: { id: orderId }, data: { opsAlert: msg.slice(0, 2000), opsAlertAt: new Date() } }).catch(() => {});
}

/** Estorna o dinheiro da devolução. Falha ou gateway sem API → fica "estorno pendente", visível no admin. */
async function doRefund(
  returnId: string,
  order: { id: string; orderNumber: string; paymentGateway: string | null },
  amount: number
): Promise<{ success: boolean; message: string; pending?: boolean }> {
  if (amount <= 0) {
    await prisma.return.update({ where: { id: returnId }, data: { refundedAt: new Date(), refundError: null } }).catch(() => {});
    return { success: true, message: "Sem valor em dinheiro a estornar." };
  }
  const gateway = order.paymentGateway;
  if (gateway === "mercadopago" || gateway === "nupay") {
    const r = await refundPartialPayment(order.orderNumber, amount);
    if (r.success) {
      await prisma.return.update({ where: { id: returnId }, data: { refundedAt: new Date(), refundError: null } });
      return { success: true, message: r.message };
    }
    await prisma.return.update({ where: { id: returnId }, data: { refundError: r.message.slice(0, 1000) } });
    await flagOrder(order.id, `Estorno de devolução FALHOU (R$ ${amount.toFixed(2)}): ${r.message}. Use "Tentar estorno de novo" em Devoluções.`);
    return { success: false, pending: true, message: r.message };
  }
  // Infinity Pay (sem API de estorno), WhatsApp ou sem gateway: o dono faz o estorno e confirma aqui
  const where = gateway === "infinitypay" ? "pelo painel da InfinityPay" : "diretamente ao cliente (Pix/transferência)";
  const msg = `${MANUAL_PREFIX} faça o estorno de R$ ${amount.toFixed(2)} ${where} e depois clique em "Marcar como estornado".`;
  await prisma.return.update({ where: { id: returnId }, data: { refundError: msg } });
  return { success: true, pending: true, message: msg };
}

async function retryRefund(id: string) {
  const r = await prisma.return.findUnique({ where: { id }, include: { order: { select: { id: true, orderNumber: true, paymentGateway: true } } } });
  if (!r || r.status !== "APPROVED") return NextResponse.json({ error: "Só devoluções aprovadas" }, { status: 400 });
  if (r.refundedAt) return NextResponse.json({ error: "Esta devolução já foi estornada" }, { status: 409 });
  // Evita dois cliques simultâneos estornarem duas vezes
  const claim = await prisma.return.updateMany({ where: { id, refundedAt: null, OR: [{ refundError: null }, { refundError: { not: "processando" } }] }, data: { refundError: "processando" } });
  if (claim.count === 0) return NextResponse.json({ error: "Estorno já em andamento" }, { status: 409 });
  const refund = await doRefund(id, r.order, r.refundAmount);
  const updated = await prisma.return.findUnique({ where: { id } });
  return NextResponse.json({ ...updated, refund });
}

async function markRefunded(id: string) {
  const res = await prisma.return.updateMany({ where: { id, status: "APPROVED", refundedAt: null }, data: { refundedAt: new Date(), refundError: null } });
  if (res.count === 0) return NextResponse.json({ error: "Nada a marcar" }, { status: 409 });
  const updated = await prisma.return.findUnique({ where: { id } });
  return NextResponse.json({ ...updated, refund: { success: true, message: "Estorno marcado como feito" } });
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
