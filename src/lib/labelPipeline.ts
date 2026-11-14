/**
 * Etiqueta do Melhor Envio do começo ao fim, sem o dono da loja entrar no painel do Melhor Envio:
 *
 *   carrinho (pending) → pagar com o saldo (released) → gerar (generated: nasce o código de rastreio)
 *   → link de impressão → PDF salvo no servidor, pronto para a impressora térmica
 *
 * Cada passo olha o status atual no Melhor Envio antes de agir, então pode ser repetido sem
 * pagar ou gerar duas vezes. Erros (ex.: saldo insuficiente) ficam em `labelStepError` e são
 * tentados de novo pela rotina ou pelo botão "Tentar de novo".
 */
import path from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkoutMeShipment, generateMeShipment, getMeOrder, printMeShipments } from "@/lib/melhorEnvio";
import { createAutomaticShipment } from "@/lib/shipmentUtils";
import { getCarrierTracking } from "@/lib/carrierTracking";
import { sendShippingConfirmationEmail } from "@/lib/email";
import { needsMelhorEnvioLabel } from "@/lib/utils";

/** Pasta privada das etiquetas (não é servida publicamente; só pelas rotas do admin). */
export const LABEL_DIR = process.env.PERSISTENT_UPLOAD_DIR
  ? path.join(path.resolve(process.env.PERSISTENT_UPLOAD_DIR), "_etiquetas")
  : path.join(process.cwd(), ".data", "etiquetas");

const GENERATED = new Set(["generated", "posted", "in_transit", "delivered", "undelivered"]);
/** Já saiu com a transportadora: imprimir não é mais necessário */
const SHIPPED = new Set(["posted", "in_transit", "delivered", "undelivered"]);
const DEAD = new Set(["canceled", "cancelled", "expired"]);

export interface LabelResult {
  ok: boolean;
  stage?: "pending" | "paid" | "generated" | "ready" | "error";
  message: string;
}

const running = new Map<string, Promise<LabelResult>>();
function once(orderId: string, fn: () => Promise<LabelResult>) {
  const cur = running.get(orderId);
  if (cur) return cur;
  const p = fn().finally(() => running.delete(orderId));
  running.set(orderId, p);
  return p;
}

const isBalanceError = (msg: string) => /saldo|balance|insufficient|insuficiente|carteira/i.test(msg);

async function fail(orderId: string, message: string): Promise<LabelResult> {
  await prisma.order.update({
    where: { id: orderId },
    data: { labelStepError: message.slice(0, 2000), labelStepAttempts: { increment: 1 }, labelLastAttemptAt: new Date() },
  });
  return {
    ok: false,
    stage: "error",
    message: isBalanceError(message) ? `Saldo insuficiente no Melhor Envio. Adicione saldo e tente de novo (a etiqueta continua reservada). — ${message}` : message,
  };
}

/** Baixa o PDF do link de impressão. Devolve o nome do arquivo salvo, ou null se o link não for um PDF. */
async function savePdf(orderNumber: string, url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30000), headers: { "User-Agent": "VirtualClothingStore/1.0" } });
    const type = res.headers.get("content-type") || "";
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Confere pela assinatura do arquivo, não só pelo cabeçalho
    if (!type.includes("pdf") && buf.subarray(0, 5).toString() !== "%PDF-") return null;
    await mkdir(LABEL_DIR, { recursive: true });
    const name = `etiqueta-${orderNumber.replace(/[^\w-]/g, "")}-${Date.now()}.pdf`;
    await writeFile(path.join(LABEL_DIR, name), buf);
    return name;
  } catch (e) {
    console.error("[ETIQUETA] Não foi possível baixar o PDF:", e);
    return null;
  }
}

/**
 * PDF da etiqueta para imprimir: usa o arquivo salvo; se não houver, pede um link novo ao Melhor Envio
 * e tenta salvar. Devolve o PDF, ou o link do Melhor Envio quando ele não entrega PDF.
 */
export async function obterEtiquetaParaImprimir(orderId: string): Promise<{ pdf?: Buffer; url?: string; filename: string } | { error: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, melhorEnvioShipmentId: true, labelFile: true, labelGeneratedAt: true, shipmentStatus: true },
  });
  if (!order?.melhorEnvioShipmentId) return { error: "Pedido sem etiqueta" };
  const filename = `etiqueta-${order.orderNumber}.pdf`;
  if (order.labelFile) {
    const buf = await readLabelFile(order.labelFile);
    if (buf) return { pdf: buf, filename };
  }
  // Etiquetas antigas (geradas direto no Melhor Envio) não têm labelGeneratedAt, mas têm o status
  if (!order.labelGeneratedAt && !GENERATED.has(order.shipmentStatus || "")) return { error: "A etiqueta ainda não foi gerada. Use “Preparar etiqueta”." };
  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { melhorEnvioApiToken: true } });
  if (!settings?.melhorEnvioApiToken) return { error: "Token do Melhor Envio não configurado" };
  try {
    const url = await printMeShipments(settings.melhorEnvioApiToken, [order.melhorEnvioShipmentId]);
    const saved = await savePdf(order.orderNumber, url);
    await prisma.order.update({ where: { id: orderId }, data: { labelPrintUrl: url, ...(saved ? { labelFile: saved } : {}) } });
    if (saved) {
      const buf = await readLabelFile(saved);
      if (buf) return { pdf: buf, filename };
    }
    return { url, filename };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível obter a etiqueta" };
  }
}

/** Várias etiquetas num arquivo só (para imprimir o lote do dia de uma vez na térmica). */
export async function obterEtiquetasEmLote(orderIds: string[]): Promise<{ pdf?: Buffer; url?: string; count: number } | { error: string }> {
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds.slice(0, 50) }, melhorEnvioShipmentId: { not: null }, labelGeneratedAt: { not: null } },
    select: { id: true, melhorEnvioShipmentId: true },
  });
  if (!orders.length) return { error: "Nenhum dos pedidos escolhidos tem etiqueta gerada" };
  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { melhorEnvioApiToken: true } });
  if (!settings?.melhorEnvioApiToken) return { error: "Token do Melhor Envio não configurado" };
  try {
    const url = await printMeShipments(settings.melhorEnvioApiToken, orders.map((o) => o.melhorEnvioShipmentId!));
    const name = await savePdf(`lote-${orders.length}`, url);
    await prisma.order.updateMany({ where: { id: { in: orders.map((o) => o.id) } }, data: { labelPrintedAt: new Date() } });
    const pdf = name ? await readLabelFile(name) : null;
    return pdf ? { pdf, count: orders.length } : { url, count: orders.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível montar as etiquetas" };
  }
}

export async function readLabelFile(name: string): Promise<Buffer | null> {
  if (!/^[\w.-]+\.pdf$/.test(name)) return null;
  try { return await readFile(path.join(LABEL_DIR, name)); } catch { return null; }
}

/**
 * Leva a etiqueta do pedido até "pronta para imprimir": cria (se ainda não existe), paga, gera,
 * guarda o código de rastreio (e avisa o cliente) e salva o PDF.
 */
export function prepararEtiqueta(orderId: string): Promise<LabelResult> {
  return once(orderId, async () => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, orderNumber: true, status: true, shippingMethod: true, customerName: true, customerEmail: true,
        melhorEnvioShipmentId: true, trackingCode: true, labelFile: true, labelPrintUrl: true, labelGeneratedAt: true, shippingLabelCost: true,
      },
    });
    if (!order) return { ok: false, message: "Pedido não encontrado" };
    if (!needsMelhorEnvioLabel(order.shippingMethod)) return { ok: false, message: "Este pedido não usa etiqueta (retirada/entrega local)" };
    if (order.status === "PENDING" || order.status === "CANCELLED") return { ok: false, message: "Só pedidos pagos recebem etiqueta" };

    const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { melhorEnvioApiToken: true, name: true } });
    const token = settings?.melhorEnvioApiToken;
    if (!token) return fail(orderId, "Token do Melhor Envio (criar etiquetas) não configurado");

    // 1) Ainda não existe no Melhor Envio: cria e paga (o próprio createAutomaticShipment registra os erros)
    let shipmentId = order.melhorEnvioShipmentId;
    if (!shipmentId) {
      try {
        await createAutomaticShipment(orderId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const again = await prisma.order.findUnique({ where: { id: orderId }, select: { melhorEnvioShipmentId: true } });
        if (!again?.melhorEnvioShipmentId) return { ok: false, stage: "error", message: msg };
      }
      shipmentId = (await prisma.order.findUnique({ where: { id: orderId }, select: { melhorEnvioShipmentId: true } }))?.melhorEnvioShipmentId ?? null;
      if (!shipmentId) return { ok: false, stage: "error", message: "A etiqueta não foi criada no Melhor Envio" };
    }

    try {
      // 2) Avança conforme o status atual (no máximo 3 passos: pagar → gerar → pronto)
      let me = await getMeOrder(token, shipmentId);
      for (let i = 0; i < 3; i++) {
        if (DEAD.has(me.status)) {
          await prisma.order.update({ where: { id: orderId }, data: { labelValid: false, labelError: "Etiqueta cancelada/expirada no Melhor Envio. Gere uma nova.", shipmentStatus: me.status } });
          return fail(orderId, "A etiqueta foi cancelada ou expirou no Melhor Envio. Use “Recriar etiqueta”.");
        }
        if (me.status === "pending") {
          await checkoutMeShipment(token, shipmentId);
        } else if (me.status === "released") {
          await generateMeShipment(token, shipmentId);
        } else {
          break;
        }
        me = await getMeOrder(token, shipmentId);
      }
      if (!GENERATED.has(me.status)) {
        return fail(orderId, `A etiqueta ainda não foi gerada pelo Melhor Envio (status: ${me.status || "desconhecido"}). Tente de novo em alguns minutos.`);
      }

      // 3) Código de rastreio (nasce na geração; algumas transportadoras só informam depois — a rotina de rastreio completa)
      const firstTracking = !!me.tracking && !order.trackingCode;
      const trackingUrl = me.tracking ? getCarrierTracking(me.tracking).url : null;

      // 4) PDF para imprimir (se o link não for PDF, fica o link público como alternativa)
      let labelFile = order.labelFile;
      let labelPrintUrl = order.labelPrintUrl;
      let note = "";
      if (!labelFile) {
        try {
          labelPrintUrl = await printMeShipments(token, [shipmentId]);
          labelFile = await savePdf(order.orderNumber, labelPrintUrl);
        } catch (e) {
          // Pacote já postado/entregue: o Melhor Envio pode não liberar mais a impressão — não é erro
          if (!SHIPPED.has(me.status)) throw e;
          note = " (pacote já despachado; o Melhor Envio não liberou o PDF)";
        }
      }

      await prisma.order.update({
        where: { id: orderId },
        data: {
          shipmentStatus: me.status,
          labelValid: true,
          labelError: null,
          labelStepError: null,
          labelLastAttemptAt: new Date(),
          labelGeneratedAt: order.labelGeneratedAt ?? new Date(),
          labelFile,
          labelPrintUrl,
          ...(me.tracking && !order.trackingCode ? { trackingCode: me.tracking, trackingUrl } : {}),
          ...(order.shippingLabelCost == null && me.price != null ? { shippingLabelCost: me.price } : {}),
          shipmentRetryError: null,
          shipmentRetryableError: false,
        },
      });

      if (firstTracking && order.customerEmail) {
        await sendShippingConfirmationEmail({
          to: order.customerEmail,
          customerName: order.customerName,
          orderNumber: order.orderNumber,
          trackingCode: me.tracking!,
          trackingUrl: trackingUrl || "",
          storeName: settings?.name || "Loja",
        }).catch((e) => console.error("[ETIQUETA] Falha ao enviar e-mail do rastreio:", e));
      }

      return {
        ok: true,
        stage: "ready",
        message: SHIPPED.has(me.status)
          ? `Atualizado do Melhor Envio: ${me.status === "delivered" ? "entregue" : me.status === "undelivered" ? "não entregue" : "já postado"}${me.tracking ? ` · rastreio ${me.tracking}` : ""}${labelFile ? " · PDF salvo" : note}`
          : `Etiqueta pronta${me.tracking ? ` · rastreio ${me.tracking}` : ""}${labelFile ? "" : " (abra pelo link do Melhor Envio)"}`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ETIQUETA] ${order.orderNumber}:`, msg);
      return fail(orderId, msg);
    }
  });
}

/** Roda depois da resposta (o webhook de pagamento não espera o Melhor Envio). */
export function prepararEtiquetaEmSegundoPlano(orderId: string) {
  const task = () => prepararEtiqueta(orderId).then((r) => console.log(`[ETIQUETA] ${orderId}: ${r.message}`)).catch((e) => console.error("[ETIQUETA]", e));
  try { after(task); } catch { void task(); }
}

/**
 * Rotina: tenta de novo as etiquetas travadas (sem saldo, falha temporária, ainda não geradas)
 * e as que falharam antes de existir no Melhor Envio. Espaça as tentativas para não insistir à toa.
 */
export async function processarEtiquetasPendentes() {
  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { melhorEnvioApiToken: true } });
  if (!settings?.melhorEnvioApiToken) return { tried: 0, ready: 0 };
  const twentyMinAgo = new Date(Date.now() - 20 * 60_000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000);

  const orders = await prisma.order.findMany({
    where: {
      status: "CONFIRMED",
      shippingMethod: { notIn: ["local", "retirada"] },
      createdAt: { gte: fourteenDaysAgo },
      labelStepAttempts: { lt: 30 },
      AND: [
        { OR: [{ labelLastAttemptAt: null }, { labelLastAttemptAt: { lt: twentyMinAgo } }] },
        {
          OR: [
            // Criada mas travada (pagar/gerar/imprimir)
            { melhorEnvioShipmentId: { not: null }, labelValid: { not: false }, OR: [{ labelStepError: { not: null } }, { labelGeneratedAt: null }] },
            // Falhou antes de existir no Melhor Envio por falta de saldo
            { melhorEnvioShipmentId: null, shipmentRetryableError: true },
          ],
        },
      ],
    },
    select: { id: true, shippingMethod: true },
    orderBy: { createdAt: "asc" },
    take: 15,
  });

  let ready = 0;
  for (const o of orders) {
    if (!needsMelhorEnvioLabel(o.shippingMethod)) continue;
    const r = await prepararEtiqueta(o.id);
    if (r.ok) ready++;
  }
  return { tried: orders.length, ready };
}
