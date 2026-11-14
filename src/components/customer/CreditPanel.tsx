"use client";

import Link from "next/link";
import { CalendarClock, Clock, Gift, ShoppingBag, Sparkles } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { CreditSummary, LedgerEntry } from "@/lib/cashback";

export interface CreditData extends CreditSummary {
  program: { percent: number; releaseDays: number; validityDays: number; maxUsePercent: number; minOrder: number } | null;
}

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "");

const STATUS: Record<LedgerEntry["status"], { label: string; cls: string }> = {
  pending: { label: "A liberar", cls: "bg-sky-50 text-sky-700" },
  available: { label: "Disponível", cls: "bg-emerald-50 text-emerald-700" },
  partial: { label: "Em uso", cls: "bg-emerald-50 text-emerald-700" },
  used: { label: "Usado", cls: "bg-gray-100 text-gray-600" },
  expired: { label: "Venceu", cls: "bg-gray-100 text-gray-500" },
  cancelled: { label: "Cancelado", cls: "bg-gray-100 text-gray-500" },
};

function entryHint(e: LedgerEntry) {
  if (e.kind === "redeem") return e.status === "cancelled" ? "O crédito voltou para você" : "Desconto aplicado na compra";
  if (e.status === "pending") return e.availableAt ? `Libera em ${fmtDate(e.availableAt)}` : "Libera depois da entrega + prazo de troca";
  if (e.status === "partial") return `Restam ${formatCurrency(e.remaining ?? 0)}${e.expiresAt ? ` · vale até ${fmtDate(e.expiresAt)}` : ""}`;
  if (e.status === "available") return e.expiresAt ? `Vale até ${fmtDate(e.expiresAt)}` : "";
  if (e.status === "expired") return `Venceu em ${fmtDate(e.expiresAt)}`;
  if (e.status === "cancelled") return "Pedido cancelado ou devolvido";
  return "";
}

/** Quadro do crédito (cashback) na conta do cliente: saldo, a liberar, vencimentos, como funciona e extrato. */
export default function CreditPanel({ data }: { data: CreditData | null }) {
  if (!data) return <div className="img-skeleton rounded-2xl h-48" />;
  const p = data.program;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl p-5 text-on-brand shadow-lg relative overflow-hidden" style={{ background: "linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 55%, #111827))" }}>
        <span className="absolute -top-14 -right-10 w-44 h-44 rounded-full bg-white/10" />
        <div className="relative">
          <p className="text-xs font-medium opacity-75 uppercase tracking-wider flex items-center gap-1.5"><Sparkles size={13} /> Seu crédito</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{formatCurrency(data.available)}</p>
          <p className="text-sm opacity-75">disponível para usar na próxima compra</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="opacity-75 flex items-center gap-1"><Clock size={12} /> A liberar</p>
              <p className="font-semibold tabular-nums">{formatCurrency(data.pending)}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="opacity-75 flex items-center gap-1"><CalendarClock size={12} /> Próximo vencimento</p>
              <p className="font-semibold tabular-nums">{data.nextExpiry ? `${formatCurrency(data.nextExpiry.amount)} · ${fmtDate(data.nextExpiry.date)}` : "—"}</p>
            </div>
          </div>
          {data.available > 0 && (
            <Link href="/produtos" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white text-gray-900 px-4 py-2 text-sm font-semibold hover:bg-gray-50">
              <ShoppingBag size={15} /> Usar meu crédito
            </Link>
          )}
        </div>
      </section>

      {p && (
        <section className="bg-white rounded-2xl border border-gray-200/70 p-5">
          <h2 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2"><Gift size={16} className="text-brand" /> Como funciona</h2>
          <ol className="mt-3 space-y-2 text-sm text-gray-600">
            <li><b className="text-gray-900">1.</b> A cada compra, {p.percent.toLocaleString("pt-BR")}% do valor dos produtos volta para você como crédito.</li>
            <li><b className="text-gray-900">2.</b> O crédito é liberado {p.releaseDays > 0 ? `${p.releaseDays} dias depois da entrega (prazo de troca)` : "assim que o pedido é entregue"}.</li>
            <li><b className="text-gray-900">3.</b> Use no checkout em até {p.validityDays} dias{p.maxUsePercent < 100 ? `, pagando até ${p.maxUsePercent.toLocaleString("pt-BR")}% dos produtos do pedido` : ""}{p.minOrder > 0 ? ` (compras a partir de ${formatCurrency(p.minOrder)})` : ""}.</li>
          </ol>
        </section>
      )}

      <section className="bg-white rounded-2xl border border-gray-200/70 p-5">
        <h2 className="text-[15px] font-semibold text-gray-900">Extrato</h2>
        {data.entries.length === 0 ? (
          <p className="text-sm text-gray-500 mt-3">Ainda não há movimentações. {p ? "Suas próximas compras geram crédito automaticamente." : ""}</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {data.entries.map((e) => {
              const st = STATUS[e.status];
              return (
                <li key={e.id} className="py-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {e.orderId ? <Link href={`/pedido/${e.orderId}`} className="hover:underline">{e.label}</Link> : e.label}
                    </p>
                    <p className="text-xs text-gray-500">{fmtDate(e.date)}{entryHint(e) ? ` · ${entryHint(e)}` : ""}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold tabular-nums ${e.amount < 0 ? "text-gray-700" : e.status === "cancelled" || e.status === "expired" ? "text-gray-400 line-through" : "text-brand"}`}>
                      {e.amount < 0 ? `−${formatCurrency(-e.amount)}` : `+${formatCurrency(e.amount)}`}
                    </p>
                    <span className={`inline-block mt-0.5 text-[10.5px] font-semibold rounded-full px-1.5 py-0.5 ${st.cls}`}>{st.label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
