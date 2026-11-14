/**
 * Nota fiscal (NF-e) emitida pelo Bling a partir do pedido de venda.
 *
 *   pedido pago → pedido no Bling → gerar NF-e (POST /pedidos/vendas/{id}/gerar-nfe)
 *   → enviar à SEFAZ (POST /nfe/{id}/enviar) → acompanhar (GET /nfe/{id}, webhook, rotina)
 *   → autorizada: guarda número/série/chave e envia o e-mail com DANFE (PDF) + XML
 *   → rejeitada: guarda o motivo vindo do Bling/SEFAZ para o admin corrigir e reenviar
 *
 * A SEFAZ responde de forma assíncrona: a nota pode ficar alguns minutos "aguardando".
 */
import { gunzipSync } from "zlib";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBlingAccessToken } from "@/lib/blingService";
import { sendInvoiceEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site";

const API = "https://api.bling.com.br/Api/v3";
const PAID = ["CONFIRMED", "SHIPPED", "PRONTO_PARA_RETIRADA", "DELIVERED", "RETIRADO"];

export type NfeStatus = "pending" | "processing" | "authorized" | "rejected" | "denied" | "cancelled" | "error";

/** Situação do Bling → status do site. 1 Pendente · 2 Cancelada · 3 Aguardando recibo · 4 Rejeitada · 5 Autorizada · 6 Emitida DANFE · 7 Registrada · 8 Aguardando protocolo · 9 Denegada · 10 Consulta situação · 11 Bloqueada */
export function statusFromSituacao(situacao: number | null | undefined): NfeStatus {
  switch (situacao) {
    case 5: case 6: case 7: return "authorized";
    case 4: return "rejected";
    case 9: return "denied";
    case 2: return "cancelled";
    case 3: case 8: case 10: return "processing";
    case 11: return "error";
    default: return "pending";
  }
}

export const NFE_STATUS_LABEL: Record<NfeStatus, string> = {
  pending: "Gerada, não enviada",
  processing: "Aguardando SEFAZ",
  authorized: "Autorizada",
  rejected: "Rejeitada",
  denied: "Denegada",
  cancelled: "Cancelada",
  error: "Erro na emissão",
};

interface BlingResult<T = unknown> { ok: boolean; status: number; json: T | null; text: string }

async function bling<T = unknown>(token: string, method: "GET" | "POST", path: string): Promise<BlingResult<T>> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(45000), // envio à SEFAZ pode levar até ~30s
  });
  const text = await res.text();
  let json: T | null = null;
  try { json = text ? (JSON.parse(text) as T) : null; } catch {}
  return { ok: res.ok, status: res.status, json, text };
}

type BlingError = { error?: { type?: string; message?: string; description?: string; fields?: { msg?: string; element?: string }[] } };

/** Mensagem legível a partir do erro do Bling (inclui o motivo da SEFAZ quando vier). */
function errorMessage(r: BlingResult, fallback: string): string {
  const e = (r.json as BlingError | null)?.error;
  if (!e) return r.text ? `${fallback} (HTTP ${r.status}): ${r.text.slice(0, 400)}` : `${fallback} (HTTP ${r.status})`;
  const parts = [e.description || e.message, ...(e.fields || []).map((f) => f.msg).filter(Boolean)];
  const uniq = [...new Set(parts.filter(Boolean) as string[])];
  return uniq.join(" · ") || fallback;
}

interface NfeInfo {
  id: number;
  situacao: number;
  numero?: string;
  serie?: number | string;
  chaveAcesso?: string;
  linkDanfe?: string;
  linkPDF?: string;
}

async function getNfe(token: string, nfeId: string): Promise<NfeInfo | null> {
  const r = await bling<{ data?: NfeInfo }>(token, "GET", `/nfe/${nfeId}`);
  return r.ok && r.json?.data ? r.json.data : null;
}

// Um pedido por vez (webhook, rotina e botão do admin podem chegar juntos)
const running = new Map<string, Promise<NfeResult>>();
function once(orderId: string, fn: () => Promise<NfeResult>): Promise<NfeResult> {
  const cur = running.get(orderId);
  if (cur) return cur;
  const p = fn().finally(() => running.delete(orderId));
  running.set(orderId, p);
  return p;
}

export interface NfeResult { ok: boolean; status?: NfeStatus; message?: string }

const ORDER_SELECT = {
  id: true, orderNumber: true, status: true, blingPedidoId: true,
  nfeId: true, nfeStatus: true, nfeError: true, nfeEmailSentAt: true,
} as const;

/** Salva o que o Bling informou e, se autorizada, dispara o e-mail com a nota. */
async function applyInfo(orderId: string, info: NfeInfo, extra: { error?: string | null; imported?: boolean } = {}): Promise<NfeResult> {
  const status = statusFromSituacao(info.situacao);
  const current = await prisma.order.findUnique({ where: { id: orderId }, select: { nfeAuthorizedAt: true, nfeError: true, nfeImportedAt: true } });
  const imported = extra.imported || !!current?.nfeImportedAt;
  await prisma.order.update({
    where: { id: orderId },
    data: {
      nfeId: String(info.id),
      nfeSituacao: info.situacao,
      nfeStatus: status,
      nfeNumero: info.numero || null,
      nfeSerie: info.serie != null ? String(info.serie) : null,
      nfeChave: info.chaveAcesso || null,
      nfeLastCheckAt: new Date(),
      ...(extra.imported ? { nfeImportedAt: new Date() } : {}),
      ...(status === "authorized"
        ? { nfeError: null, nfeAuthorizedAt: current?.nfeAuthorizedAt ?? new Date() }
        : extra.error !== undefined
          ? { nfeError: extra.error }
          : {}),
    },
  });
  // Nota vinculada pelo admin (emitida antes, fora do site): o e-mail só sai pelo botão
  if (status === "authorized" && !imported) {
    await sendNfeEmail(orderId).catch((e) => console.error("[NF-e] Falha ao enviar e-mail da nota:", e));
  }
  const message = status === "authorized" ? `Nota ${info.numero ?? ""} autorizada` : extra.error ?? current?.nfeError ?? NFE_STATUS_LABEL[status];
  return { ok: status !== "error" && status !== "rejected" && status !== "denied", status, message: message || undefined };
}

async function saveError(orderId: string, message: string, status: NfeStatus = "error") {
  await prisma.order.update({ where: { id: orderId }, data: { nfeStatus: status, nfeError: message.slice(0, 2000), nfeLastCheckAt: new Date() } });
}

/**
 * Gera (se ainda não existir) e envia a NF-e do pedido à SEFAZ.
 * Seguro para chamar de novo: nunca cria nota duplicada e não reenvia nota já autorizada.
 */
export function emitirNfe(orderId: string): Promise<NfeResult> {
  return once(orderId, async () => {
    try {
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: ORDER_SELECT });
      if (!order) return { ok: false, message: "Pedido não encontrado" };
      if (!PAID.includes(order.status)) return { ok: false, message: "Só pedidos pagos recebem nota fiscal" };
      if (!order.blingPedidoId) return { ok: false, message: "O pedido ainda não está no Bling. Envie ao Bling primeiro." };
      if (order.nfeStatus === "authorized") return { ok: true, status: "authorized", message: "Nota já autorizada" };

      const token = await getBlingAccessToken();
      if (!token) return { ok: false, message: "Bling não autorizado. Autorize em Configurações → Integrações." };

      await prisma.order.update({ where: { id: orderId }, data: { nfeAttempts: { increment: 1 } } });

      let nfeId = order.nfeId;
      if (!nfeId) {
        // Já existe nota para este pedido no Bling (ex.: emitida à mão)? Usa a mesma.
        const pedido = await bling<{ data?: { notaFiscal?: { id?: number } } }>(token, "GET", `/pedidos/vendas/${order.blingPedidoId}`);
        const existing = pedido.json?.data?.notaFiscal?.id;
        if (existing) {
          nfeId = String(existing);
        } else {
          const gen = await bling<{ data?: { idNotaFiscal?: number; id?: number }; idNotaFiscal?: number }>(token, "POST", `/pedidos/vendas/${order.blingPedidoId}/gerar-nfe`);
          const id = gen.json?.data?.idNotaFiscal ?? gen.json?.data?.id ?? gen.json?.idNotaFiscal;
          if (!gen.ok || !id) {
            const msg = errorMessage(gen, "Não foi possível gerar a nota no Bling");
            await saveError(orderId, msg);
            return { ok: false, status: "error", message: msg };
          }
          nfeId = String(id);
        }
        await prisma.order.update({ where: { id: orderId }, data: { nfeId, nfeStatus: "pending", nfeError: null } });
      }

      const before = await getNfe(token, nfeId);
      if (before) {
        const st = statusFromSituacao(before.situacao);
        // Já autorizada, ou a SEFAZ ainda está processando: só registra
        if (st === "authorized" || st === "processing" || st === "cancelled" || st === "denied") return applyInfo(orderId, before);
      }

      const sent = await bling(token, "POST", `/nfe/${nfeId}/enviar?enviarEmail=false`);
      const after_ = await getNfe(token, nfeId);
      if (!sent.ok) {
        const msg = errorMessage(sent, "A SEFAZ não autorizou a nota");
        if (after_ && statusFromSituacao(after_.situacao) === "authorized") return applyInfo(orderId, after_);
        // Falha de comunicação/autorização com o Bling (não é rejeição da SEFAZ): tenta de novo depois
        if (sent.status !== 400 && sent.status !== 422) {
          await saveError(orderId, msg, "error");
          return { ok: false, status: "error", message: msg };
        }
        if (after_) return applyInfo(orderId, { ...after_, situacao: after_.situacao === 1 ? 4 : after_.situacao }, { error: msg });
        await saveError(orderId, msg, "rejected");
        return { ok: false, status: "rejected", message: msg };
      }
      if (after_) return applyInfo(orderId, after_, { error: null });
      await prisma.order.update({ where: { id: orderId }, data: { nfeStatus: "processing", nfeError: null, nfeLastCheckAt: new Date() } });
      return { ok: true, status: "processing", message: "Enviada à SEFAZ, aguardando retorno" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      console.error("[NF-e] Erro ao emitir:", e);
      await saveError(orderId, `Erro ao falar com o Bling: ${msg}`).catch(() => {});
      return { ok: false, status: "error", message: msg };
    }
  });
}

/** Consulta a situação atual da nota no Bling e atualiza o pedido (envia o e-mail se acabou de ser autorizada). */
export function consultarNfe(orderId: string): Promise<NfeResult> {
  return once(orderId, async () => {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: ORDER_SELECT });
    if (!order?.nfeId) return { ok: false, message: "Este pedido ainda não tem nota" };
    const token = await getBlingAccessToken();
    if (!token) return { ok: false, message: "Bling não autorizado" };
    const info = await getNfe(token, order.nfeId);
    if (!info) return { ok: false, message: "Não foi possível consultar a nota no Bling" };

    // Rejeitada sem motivo registrado (ex.: rejeição chegou depois, pelo webhook):
    // um novo envio devolve o motivo da SEFAZ — ou autoriza, se o problema já foi corrigido no Bling.
    if (statusFromSituacao(info.situacao) === "rejected" && !order.nfeError) {
      const sent = await bling(token, "POST", `/nfe/${order.nfeId}/enviar?enviarEmail=false`);
      const again = (await getNfe(token, order.nfeId)) ?? info;
      const reason = sent.ok ? null : errorMessage(sent, "Rejeitada pela SEFAZ (veja o motivo no Bling)");
      return applyInfo(orderId, again, { error: statusFromSituacao(again.situacao) === "authorized" ? null : reason ?? "Rejeitada pela SEFAZ (veja o motivo no Bling)" });
    }
    return applyInfo(orderId, info);
  });
}

type NfeListItem = NfeInfo & { dataEmissao?: string; contato?: { numeroDocumento?: string } };

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Procura no Bling uma nota JÁ emitida para o pedido e vincula ao site (sem gerar, sem enviar à SEFAZ, sem e-mail).
 * Ordem: nota ligada ao pedido de venda → nota com o número do pedido da loja → nota de saída para o mesmo CPF/CNPJ
 * emitida até 30 dias depois do pedido.
 */
export function buscarNfeExistente(orderId: string): Promise<NfeResult> {
  return once(orderId, async () => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, createdAt: true, cpfCnpj: true, blingPedidoId: true, nfeStatus: true },
    });
    if (!order) return { ok: false, message: "Pedido não encontrado" };
    if (order.nfeStatus === "authorized") return { ok: true, status: "authorized", message: "Este pedido já tem nota vinculada" };
    const token = await getBlingAccessToken();
    if (!token) return { ok: false, message: "Bling não autorizado. Autorize em Configurações → Integrações." };

    let found: NfeInfo | null = null;
    let how = "";

    if (order.blingPedidoId) {
      const pedido = await bling<{ data?: { notaFiscal?: { id?: number } } }>(token, "GET", `/pedidos/vendas/${order.blingPedidoId}`);
      const id = pedido.json?.data?.notaFiscal?.id;
      if (id) { found = await getNfe(token, String(id)); how = "pelo pedido no Bling"; }
    }

    const usable = (n: NfeListItem) => n.situacao !== 2; // ignora canceladas
    if (!found) {
      const r = await bling<{ data?: NfeListItem[] }>(token, "GET", `/nfe?tipo=1&numeroLoja=${encodeURIComponent(order.orderNumber)}&limite=10`);
      const hit = (r.json?.data || []).find(usable);
      if (hit) { found = (await getNfe(token, String(hit.id))) ?? hit; how = "pelo número do pedido"; }
    }

    const doc = (order.cpfCnpj || "").replace(/\D/g, "");
    if (!found && doc.length >= 11) {
      const from = new Date(order.createdAt.getTime() - 86_400_000);
      const to = new Date(order.createdAt.getTime() + 30 * 86_400_000);
      const r = await bling<{ data?: NfeListItem[] }>(
        token,
        "GET",
        `/nfe?tipo=1&limite=100&dataEmissaoInicial=${encodeURIComponent(`${ymd(from)} 00:00:00`)}&dataEmissaoFinal=${encodeURIComponent(`${ymd(to)} 23:59:59`)}`
      );
      const sameDoc = (r.json?.data || []).filter((n) => usable(n) && (n.contato?.numeroDocumento || "").replace(/\D/g, "") === doc);
      // Mais próxima da data do pedido (o mesmo cliente pode ter outras compras)
      sameDoc.sort((a, b) =>
        Math.abs(new Date(a.dataEmissao || 0).getTime() - order.createdAt.getTime()) - Math.abs(new Date(b.dataEmissao || 0).getTime() - order.createdAt.getTime())
      );
      if (sameDoc[0]) { found = (await getNfe(token, String(sameDoc[0].id))) ?? sameDoc[0]; how = "pelo CPF/CNPJ do cliente"; }
    }

    if (!found) return { ok: false, message: "Nenhuma nota encontrada no Bling para este pedido. Se ainda não foi emitida, use “Emitir nota fiscal”." };
    const r = await applyInfo(orderId, found, { imported: true });
    return { ...r, message: `Nota ${found.numero ? `nº ${found.numero} ` : ""}encontrada ${how} (${NFE_STATUS_LABEL[statusFromSituacao(found.situacao)].toLowerCase()})` };
  });
}

/** Baixa o DANFE (pdf) ou o XML da nota pela chave de acesso. */
export async function baixarDocumentoNfe(chave: string, formato: "pdf" | "xml"): Promise<{ buffer: Buffer; filename: string } | null> {
  if (!/^\d{44}$/.test(chave)) return null;
  const token = await getBlingAccessToken();
  if (!token) return null;
  const r = await bling<{ data?: { nome?: string; conteudo?: string }[] }>(token, "GET", `/nfe/documento/${chave}?formato=${formato}`);
  const doc = r.json?.data?.[0];
  if (!r.ok || !doc?.conteudo) return null;
  try {
    // Conteúdo vem comprimido com GZIP e codificado em base64
    const buffer = gunzipSync(Buffer.from(doc.conteudo, "base64"));
    const filename = doc.nome?.trim() || `NFe-${chave}.${formato}`;
    return { buffer, filename: filename.endsWith(`.${formato}`) ? filename : `${filename}.${formato}` };
  } catch (e) {
    console.error("[NF-e] Documento inválido:", e);
    return null;
  }
}

/**
 * Envia ao cliente o e-mail com a nota (DANFE + XML). Só uma vez por pedido,
 * a não ser que `force` (botão "Reenviar e-mail" do admin).
 */
export async function sendNfeEmail(orderId: string, force = false): Promise<boolean> {
  // Marca antes de enviar para webhook e rotina não mandarem duas vezes
  const claimed = await prisma.order.updateMany({
    where: { id: orderId, nfeStatus: "authorized", nfeChave: { not: null }, ...(force ? {} : { nfeEmailSentAt: null }) },
    data: { nfeEmailSentAt: new Date() },
  });
  if (claimed.count === 0) return false;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true, customerName: true, customerEmail: true, nfeNumero: true, nfeSerie: true, nfeChave: true, customer: { select: { email: true } } },
    });
    const to = order?.customer?.email || order?.customerEmail;
    if (!order?.nfeChave || !to) return false;

    const [pdf, xml, settings] = await Promise.all([
      baixarDocumentoNfe(order.nfeChave, "pdf"),
      baixarDocumentoNfe(order.nfeChave, "xml"),
      prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { name: true } }),
    ]);
    if (!pdf && !xml) throw new Error("Não foi possível baixar o DANFE/XML no Bling");

    await sendInvoiceEmail({
      to,
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      storeName: settings?.name || "Loja",
      numero: order.nfeNumero,
      serie: order.nfeSerie,
      chave: order.nfeChave,
      orderUrl: `${siteUrl()}/pedido/${orderId}`,
      attachments: [pdf, xml].filter((a) => a != null).map((a) => ({ filename: a.filename, content: a.buffer })),
    });
    return true;
  } catch (e) {
    // Libera para tentar de novo na próxima consulta
    await prisma.order.update({ where: { id: orderId }, data: { nfeEmailSentAt: null } }).catch(() => {});
    throw e;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Roda depois da resposta (webhooks de pagamento não ficam esperando a SEFAZ). Fora de uma requisição, roda direto. */
function runAfter(task: () => Promise<unknown>) {
  const safe = () => task().catch((e) => console.error("[NF-e] Tarefa em segundo plano falhou:", e));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

/** Acompanha a nota por alguns minutos logo após o envio (a SEFAZ costuma responder rápido). */
export function acompanharNfe(orderId: string) {
  runAfter(async () => {
    for (const wait of [20_000, 60_000, 180_000]) {
      await sleep(wait);
      const o = await prisma.order.findUnique({ where: { id: orderId }, select: { nfeStatus: true } });
      if (!o || (o.nfeStatus !== "processing" && o.nfeStatus !== "pending")) return;
      await consultarNfe(orderId);
    }
  });
}

/** Chamado quando o pedido pago entra no Bling: emite a nota se a emissão automática estiver ligada. */
export async function emitirNfeAutomatica(orderId: string) {
  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { blingAtivo: true, blingNfeAuto: true } });
  if (!settings?.blingAtivo || !settings.blingNfeAuto) return;
  runAfter(async () => {
    const r = await emitirNfe(orderId);
    console.log(`[NF-e] Emissão automática do pedido ${orderId}:`, r);
    if (r.status === "processing" || r.status === "pending") acompanharNfe(orderId);
  });
}

/**
 * Rotina (cron): confere notas aguardando a SEFAZ, tenta de novo emissões automáticas que falharam
 * por instabilidade e reenvia e-mails que não saíram.
 */
export async function processarNfesPendentes() {
  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { blingAtivo: true, blingNfeAuto: true } });
  if (!settings?.blingAtivo) return { checked: 0, emitted: 0, emails: 0 };
  const twoMinAgo = new Date(Date.now() - 2 * 60_000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

  const waiting = await prisma.order.findMany({
    where: { nfeId: { not: null }, nfeStatus: { in: ["processing", "pending"] }, OR: [{ nfeLastCheckAt: null }, { nfeLastCheckAt: { lt: twoMinAgo } }] },
    select: { id: true },
    take: 30,
  });
  for (const o of waiting) await consultarNfe(o.id);

  let emitted = 0;
  if (settings.blingNfeAuto) {
    // Pedidos pagos no Bling sem nota (falha temporária na emissão automática). Rejeitadas ficam para o admin corrigir.
    const missing = await prisma.order.findMany({
      where: {
        status: { in: PAID },
        blingPedidoId: { not: null },
        createdAt: { gte: sevenDaysAgo },
        nfeAttempts: { lt: 3 },
        OR: [{ nfeId: null, nfeStatus: null }, { nfeStatus: "error" }],
      },
      select: { id: true },
      take: 10,
    });
    for (const o of missing) {
      await emitirNfe(o.id);
      emitted++;
    }
  }

  const noEmail = await prisma.order.findMany({
    where: { nfeStatus: "authorized", nfeEmailSentAt: null, nfeImportedAt: null, nfeAuthorizedAt: { gte: sevenDaysAgo } },
    select: { id: true },
    take: 10,
  });
  let emails = 0;
  for (const o of noEmail) if (await sendNfeEmail(o.id).catch(() => false)) emails++;

  return { checked: waiting.length, emitted, emails };
}
