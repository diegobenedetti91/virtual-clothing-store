"use client";

import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, Download, FileText, Mail, RefreshCw, Send, XCircle } from "lucide-react";
import { Button, buttonClasses } from "@/components/admin/ui/Button";

export interface NfeFields {
  nfeId?: string | null;
  nfeStatus?: string | null;
  nfeNumero?: string | null;
  nfeSerie?: string | null;
  nfeChave?: string | null;
  nfeError?: string | null;
  nfeAttempts?: number | null;
  nfeAuthorizedAt?: string | null;
  nfeEmailSentAt?: string | null;
}

type Msg = { type: "success" | "error"; text: string } | null;

/** Quadro da nota fiscal no pedido: situação, motivo de rejeição e ações (emitir, verificar, baixar, reenviar e-mail). */
export default function NfeCard({ orderId, initial, inBling, orderCancelled = false }: { orderId: string; initial: NfeFields; inBling: boolean; orderCancelled?: boolean }) {
  const [nfe, setNfe] = useState<NfeFields>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [copied, setCopied] = useState(false);

  const reload = async () => {
    const r = await fetch(`/api/orders/${orderId}`);
    if (r.ok) setNfe(await r.json());
  };

  const act = async (action: "emitir" | "consultar" | "email") => {
    setBusy(action);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/pedidos/${orderId}/nfe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await r.json().catch(() => ({}));
      setMsg({ type: r.ok ? "success" : "error", text: d.message || d.error || (r.ok ? "Feito" : "Não foi possível concluir") });
      await reload();
    } catch {
      setMsg({ type: "error", text: "Erro de conexão" });
    } finally {
      setBusy(null);
    }
  };

  const status = nfe.nfeStatus;
  const authorized = status === "authorized";
  const failed = status === "rejected" || status === "denied" || status === "error";
  const waiting = status === "processing" || status === "pending";

  return (
    <div className="space-y-3">
      {orderCancelled && authorized && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3 py-2.5 text-[13px] text-amber-900">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>Pedido cancelado com nota autorizada: cancele a NF-e no Bling (prazo da SEFAZ: 24 horas após a autorização).</span>
        </div>
      )}
      {!nfe.nfeId && !status ? (
        <div className="flex items-start gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <FileText size={18} className="text-gray-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{inBling ? "Nota fiscal ainda não emitida." : "A nota é emitida depois que o pedido estiver no Bling."}</p>
            {inBling && (
              <Button variant="dark" size="sm" icon={Send} onClick={() => act("emitir")} loading={busy === "emitir"} loadingText="Emitindo…" className="mt-2.5">
                Emitir nota fiscal
              </Button>
            )}
          </div>
        </div>
      ) : authorized ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm min-w-0 flex-1">
              <p className="font-semibold text-emerald-800">
                NF-e {nfe.nfeNumero ? `nº ${nfe.nfeNumero}` : ""}{nfe.nfeSerie ? ` · série ${nfe.nfeSerie}` : ""} autorizada
              </p>
              {nfe.nfeChave && (
                <p className="text-[11px] text-emerald-700/80 font-mono mt-0.5 break-all flex items-center gap-1">
                  {nfe.nfeChave}
                  <button type="button" onClick={() => { navigator.clipboard.writeText(nfe.nfeChave!); setCopied(true); setTimeout(() => setCopied(false), 1500); }} aria-label="Copiar chave de acesso" className="shrink-0 p-0.5 rounded hover:bg-emerald-100">
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </p>
              )}
              <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                <Mail size={12} />
                {nfe.nfeEmailSentAt ? `Enviada ao cliente em ${new Date(nfe.nfeEmailSentAt).toLocaleString("pt-BR")}` : "E-mail ao cliente ainda não enviado"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <a href={`/api/admin/pedidos/${orderId}/nfe?formato=pdf`} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <Download /> DANFE (PDF)
            </a>
            <a href={`/api/admin/pedidos/${orderId}/nfe?formato=xml`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <Download /> XML
            </a>
            <Button variant="ghost" size="sm" icon={Mail} onClick={() => act("email")} loading={busy === "email"} loadingText="Enviando…">
              {nfe.nfeEmailSentAt ? "Reenviar e-mail" : "Enviar e-mail"}
            </Button>
          </div>
        </div>
      ) : waiting ? (
        <div className="rounded-xl bg-sky-50 px-4 py-3">
          <div className="flex items-start gap-3 text-sm">
            <Clock size={18} className="text-sky-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sky-800">{status === "pending" ? "Nota gerada, ainda não enviada à SEFAZ" : "Aguardando retorno da SEFAZ"}</p>
              <p className="text-xs text-sky-700 mt-0.5">O site confere sozinho em alguns minutos. Se preferir, verifique agora.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => act("consultar")} loading={busy === "consultar"} loadingText="Verificando…">Verificar agora</Button>
            {status === "pending" && <Button variant="dark" size="sm" icon={Send} onClick={() => act("emitir")} loading={busy === "emitir"} loadingText="Enviando…">Enviar à SEFAZ</Button>}
          </div>
        </div>
      ) : failed ? (
        <div className="rounded-xl bg-red-50 px-4 py-3">
          <div className="flex items-start gap-3 text-sm">
            {status === "denied" ? <XCircle size={18} className="text-red-600 shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <p className="font-semibold text-red-800">
                {status === "rejected" ? "Nota rejeitada pela SEFAZ" : status === "denied" ? "Nota denegada" : "Erro ao emitir a nota"}
              </p>
              {nfe.nfeError && <p className="text-[13px] text-red-700 mt-1 whitespace-pre-line break-words"><b>Motivo:</b> {nfe.nfeError}</p>}
              <p className="text-xs text-gray-600 mt-1.5">
                {status === "denied"
                  ? "Denegação é definitiva para esta nota (problema cadastral do emitente ou destinatário). Resolva no Bling."
                  : "Corrija o problema no Bling (cadastro do produto, cliente ou natureza de operação) e reenvie."}
                {nfe.nfeAttempts ? ` Tentativas: ${nfe.nfeAttempts}.` : ""}
              </p>
            </div>
          </div>
          {status !== "denied" && (
            <div className="flex flex-wrap gap-2 mt-3">
              <Button variant="dark" size="sm" icon={Send} onClick={() => act("emitir")} loading={busy === "emitir"} loadingText="Reenviando…">Reenviar nota</Button>
              {nfe.nfeId && <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => act("consultar")} loading={busy === "consultar"} loadingText="Verificando…">Verificar no Bling</Button>}
            </div>
          )}
        </div>
      ) : status === "cancelled" ? (
        <div className="flex items-center gap-3 rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-700">
          <XCircle size={18} className="text-gray-500" /> Nota {nfe.nfeNumero ? `nº ${nfe.nfeNumero} ` : ""}cancelada no Bling.
        </div>
      ) : null}

      {msg && (
        <p className={`text-xs rounded-lg px-3 py-2 ${msg.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{msg.text}</p>
      )}
    </div>
  );
}
