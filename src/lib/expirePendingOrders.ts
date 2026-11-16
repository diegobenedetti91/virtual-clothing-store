/**
 * Pedidos de gateway que ficaram "Aguardando pagamento" (cliente saiu sem pagar).
 *
 * O estoque só é baixado quando o pagamento é confirmado, então um pedido pendente não segura peça.
 * Mas, sem prazo, ele fica aberto para sempre: o cliente pode pagar dias depois (peça já vendida para
 * outro), o cupom e o crédito de cashback — liberados após 24h — poderiam ser usados duas vezes, e o
 * pedido polui o painel. Aqui, depois de PENDING_EXPIRY_HOURS:
 *
 *  1. Consulta o gateway. Pago (aviso perdido) → processa como pago pelo próprio webhook.
 *     Boleto/pagamento ainda em análise → espera (até MAX_WAIT_DAYS).
 *  2. Senão → cancela ("pagamento não realizado"). Se o cliente pagar depois, o webhook estorna
 *     automaticamente (Mercado Pago / NuPay) ou alerta para estorno manual (InfinityPay).
 *
 * Pedidos do WhatsApp (pagamento combinado à parte, confirmado pelo dono) não expiram aqui.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { MP_TRANSPARENT_LABEL } from "@/lib/mercadoPagoTransparent";
import { getNuPayConfig, getNuPayPaymentStatus } from "@/lib/nupay";
import { releaseOrderStock } from "@/lib/stockUtils";
import { POST as mercadoPagoWebhook } from "@/app/api/checkout/mercadopago/webhook/route";
import { POST as nuPayWebhook } from "@/app/api/checkout/nupay/webhook/route";

import { PENDING_EXPIRY_HOURS } from "@/lib/pendingExpiry";
export { PENDING_EXPIRY_HOURS };
const MAX_WAIT_DAYS = 4; // boleto pode compensar em até 3 dias úteis
const HOUR = 60 * 60 * 1000;
const GATEWAY_METHODS = ["Mercado Pago", MP_TRANSPARENT_LABEL, "Infinity Pay", "NuPay"];
export const EXPIRED_REASON = `Pagamento não realizado em ${PENDING_EXPIRY_HOURS}h (expirado automaticamente)`;

type Verdict = { kind: "paid"; process: () => Promise<unknown> } | { kind: "wait" } | { kind: "unpaid" } | { kind: "unknown" };

const internalRequest = (body: unknown) =>
  new NextRequest("http://internal/expire-pending", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

async function checkMercadoPago(orderNumber: string): Promise<Verdict> {
  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { mercadoPagoAccessToken: true } });
  const token = settings?.mercadoPagoAccessToken;
  if (!token) return { kind: "unknown" };
  const res = await fetch(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderNumber)}&sort=date_created&criteria=desc`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) }
  ).catch(() => null);
  if (!res?.ok) return { kind: "unknown" };
  const data = await res.json().catch(() => null);
  const payments: { id: number | string; status: string }[] = Array.isArray(data?.results) ? data.results : [];
  const approved = payments.find((p) => p.status === "approved");
  if (approved) return { kind: "paid", process: () => mercadoPagoWebhook(internalRequest({ type: "payment", data: { id: String(approved.id) } })) };
  if (payments.some((p) => ["pending", "in_process", "authorized"].includes(p.status))) return { kind: "wait" };
  return { kind: "unpaid" };
}

async function checkNuPay(paymentId: string | null): Promise<Verdict> {
  if (!paymentId) return { kind: "unpaid" };
  const config = await getNuPayConfig();
  if (!config) return { kind: "unknown" };
  const remote = await getNuPayPaymentStatus(config, paymentId);
  if (!remote) return { kind: "unknown" };
  if (remote.status === "COMPLETED") return { kind: "paid", process: () => nuPayWebhook(internalRequest({ pspReferenceId: paymentId })) };
  return { kind: "unpaid" };
}

export interface ExpireResult {
  checked: number;
  cancelled: string[];
  confirmed: string[];
  waiting: string[];
  skipped: string[];
}

export async function expirePendingOrders(): Promise<ExpireResult> {
  const cutoff = new Date(Date.now() - PENDING_EXPIRY_HOURS * HOUR);
  const orders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
      OR: [{ paymentGateway: { in: ["mercadopago", "nupay", "infinitypay"] } }, { paymentMethod: { in: GATEWAY_METHODS } }],
    },
    select: { id: true, orderNumber: true, paymentGateway: true, paymentMethod: true, paymentId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  const result: ExpireResult = { checked: orders.length, cancelled: [], confirmed: [], waiting: [], skipped: [] };

  for (const o of orders) {
    const isNuPay = o.paymentGateway === "nupay" || o.paymentMethod === "NuPay";
    const isInfinity = o.paymentGateway === "infinitypay" || o.paymentMethod === "Infinity Pay";
    // InfinityPay: o link não pode ser consultado sem os dados da transação (só chegam no aviso de pago).
    // Se o cliente pagar depois de expirado, o webhook confere na InfinityPay e alerta o estorno.
    const verdict: Verdict = isInfinity ? { kind: "unpaid" } : isNuPay ? await checkNuPay(o.paymentId) : await checkMercadoPago(o.orderNumber);

    if (verdict.kind === "paid") {
      await verdict.process().catch((e) => console.error("[expire-pending] processar pago", o.orderNumber, e));
      const now = await prisma.order.findUnique({ where: { id: o.id }, select: { status: true } });
      (now?.status === "PENDING" ? result.skipped : result.confirmed).push(o.orderNumber);
      continue;
    }
    const tooOld = Date.now() - o.createdAt.getTime() > MAX_WAIT_DAYS * 24 * HOUR;
    if (verdict.kind === "wait" && !tooOld) {
      result.waiting.push(o.orderNumber);
      continue;
    }
    if (verdict.kind === "unknown" && !tooOld) {
      // Gateway fora do ar / sem credencial: não cancela no escuro, tenta na próxima rodada
      result.skipped.push(o.orderNumber);
      continue;
    }

    const claimed = await prisma.order.updateMany({
      where: { id: o.id, status: "PENDING" },
      data: { status: "CANCELLED", cancelReason: EXPIRED_REASON },
    });
    if (claimed.count === 0) continue;
    await releaseOrderStock(o.id).catch(() => {}); // normalmente nada a repor (só baixa no pagamento)
    result.cancelled.push(o.orderNumber);
  }

  if (result.checked) console.log("[expire-pending]", JSON.stringify(result));
  return result;
}
