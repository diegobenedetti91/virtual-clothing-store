/**
 * Cancelamento de pedido — um único caminho para o admin e para o cliente.
 *
 * Regras:
 *  - Só antes de sair da loja (aguardando pagamento, pago, pronto para retirada).
 *    Enviado / entregue / retirado → use Devoluções (estorna o valor certo e repõe só o que voltou).
 *  - Pedido pago: ESTORNA PRIMEIRO. Se o estorno falhar, o pedido NÃO é cancelado (o dinheiro não fica preso
 *    num pedido cancelado). Gateway sem estorno por API (Infinity Pay) ou pago fora (WhatsApp): cancela e
 *    deixa um alerta "faça o estorno de R$ X".
 *  - Estoque volta só se tinha sido baixado (idempotente).
 */
import { prisma } from "@/lib/prisma";
import { refundPayment } from "@/lib/refundUtils";
import { releaseOrderStock } from "@/lib/stockUtils";

export const CANCELLABLE = ["PENDING", "CONFIRMED", "PRONTO_PARA_RETIRADA"];
const PAID_NOT_SHIPPED = ["CONFIRMED", "PRONTO_PARA_RETIRADA"];

export interface CancelResult {
  ok: boolean;
  status: number;
  message: string;
  /** Estorno precisa ser feito à mão (mostrar ao admin) */
  manualRefund?: boolean;
  /** Já estava cancelado (nada foi feito, não reenviar e-mail) */
  already?: boolean;
}

export async function cancelOrder(orderId: string, opts: { reason?: string | null; by: "admin" | "customer" }): Promise<CancelResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, status: true, total: true, paymentGateway: true, paymentId: true, refundedAt: true, melhorEnvioShipmentId: true, shipmentStatus: true },
  });
  if (!order) return { ok: false, status: 404, message: "Pedido não encontrado" };
  if (order.status === "CANCELLED") return { ok: true, status: 200, message: "Pedido já estava cancelado", already: true };

  if (!CANCELLABLE.includes(order.status)) {
    return {
      ok: false,
      status: 400,
      message:
        opts.by === "admin"
          ? "Pedido já enviado, entregue ou retirado não pode ser cancelado: registre uma devolução (estorna o valor certo e repõe só as peças que voltaram)."
          : "Seu pedido já foi enviado. Depois de receber, você pode pedir a devolução em Minha conta.",
    };
  }
  if (opts.by === "customer" && order.status !== "CONFIRMED") {
    return { ok: false, status: 400, message: "Este pedido não pode ser cancelado por aqui. Fale com a loja." };
  }

  const returns = await prisma.return.count({ where: { orderId, status: { in: ["PENDING", "AWAITING_RETURN", "APPROVED"] } } });
  if (returns > 0) return { ok: false, status: 400, message: "Pedido com devolução em andamento ou aprovada não pode ser cancelado." };

  // 1) Estorno (pedido pago)
  let manualRefund = false;
  let refundNote = "";
  if (PAID_NOT_SHIPPED.includes(order.status) && !order.refundedAt) {
    const gateway = order.paymentGateway;
    if ((gateway === "mercadopago" || gateway === "nupay") && order.paymentId) {
      const r = await refundPayment(order.orderNumber);
      if (!r.success) {
        await prisma.order.update({
          where: { id: orderId },
          data: { opsAlert: `Tentativa de cancelamento: o estorno de R$ ${order.total.toFixed(2)} FALHOU (${r.message}). O pedido continua ativo.`, opsAlertAt: new Date() },
        }).catch(() => {});
        return { ok: false, status: 502, message: `Não foi possível estornar o pagamento (${r.message}). O pedido NÃO foi cancelado — tente de novo em instantes.` };
      }
      refundNote = ` Estorno de R$ ${order.total.toFixed(2)} solicitado ao ${gateway === "mercadopago" ? "Mercado Pago" : "NuPay"}.`;
    } else {
      // Infinity Pay, WhatsApp ou pago fora do site: estorno feito pelo dono
      manualRefund = true;
      const where = gateway === "infinitypay" ? "pelo painel da InfinityPay" : "diretamente ao cliente";
      refundNote = ` Faça o estorno de R$ ${order.total.toFixed(2)} ${where}.`;
    }
  }

  // 2) Cancela (condicional: dois cliques/rotas não cancelam duas vezes)
  const claimed = await prisma.order.updateMany({
    where: { id: orderId, status: { in: CANCELLABLE } },
    data: {
      status: "CANCELLED",
      cancelReason: opts.reason || (opts.by === "customer" ? "Cancelado pelo cliente" : null),
      ...(manualRefund
        ? { opsAlert: `Pedido cancelado: estorno MANUAL pendente.${refundNote} Depois, marque o alerta como resolvido.`, opsAlertAt: new Date() }
        : {}),
    },
  });
  if (claimed.count === 0) {
    // O aviso de estorno do gateway pode ter cancelado o pedido nesse meio tempo (estoque já reposto por ele)
    const now = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (now?.status === "CANCELLED") return { ok: true, status: 200, message: `Pedido cancelado.${refundNote}`, manualRefund };
    return { ok: false, status: 409, message: `O pedido mudou de situação enquanto cancelava. Atualize a página.${refundNote ? ` Atenção:${refundNote}` : ""}` };
  }

  // 3) Estoque volta (só se tinha sido baixado)
  await releaseOrderStock(orderId).catch(async (e) => {
    console.error("[CANCEL] Falha ao repor estoque:", e);
    await prisma.order.update({ where: { id: orderId }, data: { opsAlert: "Pedido cancelado, mas o estoque NÃO foi reposto automaticamente. Ajuste à mão.", opsAlertAt: new Date() } }).catch(() => {});
  });

  // 4) Etiqueta já paga no Melhor Envio: avisar para cancelar e recuperar o valor
  if (order.melhorEnvioShipmentId && !["posted", "in_transit", "delivered", "canceled", "cancelled"].includes(order.shipmentStatus || "")) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        opsAlert: `${manualRefund ? `Estorno MANUAL pendente.${refundNote} ` : ""}Etiqueta do Melhor Envio já gerada: cancele-a no painel do Melhor Envio para recuperar o valor.`,
        opsAlertAt: new Date(),
      },
    }).catch(() => {});
  }

  return { ok: true, status: 200, message: `Pedido cancelado.${refundNote}`, manualRefund };
}
