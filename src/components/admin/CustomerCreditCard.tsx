"use client";

import { useCallback, useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/admin/ui/Button";
import { fmt } from "@/components/admin/charts/theme";
import { notify } from "@/lib/notify";
import type { CreditSummary, LedgerEntry } from "@/lib/cashback";

const STATUS: Record<LedgerEntry["status"], string> = {
  pending: "a liberar", available: "disponível", partial: "em uso", used: "usado", expired: "venceu", cancelled: "cancelado",
};
const d = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");

/** Crédito (cashback) do cliente na ficha do admin: saldo, extrato e ajuste manual. */
export default function CustomerCreditCard({ customerId }: { customerId: string }) {
  const [data, setData] = useState<CreditSummary | null>(null);
  const [mode, setMode] = useState<"add" | "remove" | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/admin/clientes/${customerId}/credito`).then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {});
  }, [customerId]);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const save = async () => {
    const v = parseFloat(amount.replace(/\./g, "").replace(",", "."));
    if (!v || v <= 0) return notify.warning("Informe o valor");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clientes/${customerId}/credito`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: mode === "remove" ? -v : v, reason }),
      });
      const j = await res.json();
      if (!res.ok) return notify.error("Não foi possível ajustar", { description: j.error });
      setData(j);
      notify.success(mode === "remove" ? "Crédito retirado" : "Crédito adicionado", { description: "Já aparece no extrato do cliente." });
      setMode(null); setAmount(""); setReason("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Crédito (cashback)</h3>
      {!data ? (
        <div className="img-skeleton rounded-xl h-20" />
      ) : (
        <div className="rounded-xl ring-1 ring-violet-100 bg-violet-50/40 p-3 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["Disponível", data.available], ["A liberar", data.pending], ["Já usado", data.usedTotal]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg bg-white px-2 py-2 ring-1 ring-violet-100">
                <p className="text-[10.5px] text-gray-500">{l}</p>
                <p className="text-sm font-semibold text-violet-800 tabular-nums">{fmt.brl(v as number)}</p>
              </div>
            ))}
          </div>
          {data.nextExpiry && <p className="text-[11.5px] text-gray-500">Próximo vencimento: {fmt.brl(data.nextExpiry.amount)} em {d(data.nextExpiry.date)}</p>}

          {mode ? (
            <div className="rounded-lg bg-white ring-1 ring-gray-200 p-3 space-y-2">
              <p className="text-[13px] font-semibold text-gray-900">{mode === "add" ? "Dar crédito ao cliente" : "Retirar crédito"}</p>
              <div className="flex gap-2">
                <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="Valor (R$)" className="w-28 h-8 px-2.5 text-[13px] rounded-lg border border-gray-200" />
                <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={160} placeholder={mode === "add" ? "Motivo (ex.: cortesia pelo atraso)" : "Motivo"} className="flex-1 min-w-0 h-8 px-2.5 text-[13px] rounded-lg border border-gray-200" />
              </div>
              <p className="text-[11px] text-gray-400">O motivo aparece no extrato do cliente.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="xs" onClick={() => setMode(null)}>Cancelar</Button>
                <Button variant={mode === "add" ? "primary" : "danger"} size="xs" onClick={save} loading={saving}>{mode === "add" ? "Adicionar" : "Retirar"}</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" size="xs" icon={Plus} onClick={() => setMode("add")}>Dar crédito</Button>
              {data.available > 0 && <Button variant="ghost" size="xs" icon={Minus} onClick={() => setMode("remove")}>Retirar</Button>}
            </div>
          )}

          {data.entries.length > 0 && (
            <ul className="divide-y divide-violet-100/70 text-[12.5px]">
              {data.entries.slice(0, 8).map((e) => (
                <li key={e.id} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-gray-700">{e.label}</span>
                  <span className="text-[10.5px] text-gray-400 shrink-0">{STATUS[e.status]}</span>
                  <span className={`tabular-nums font-semibold shrink-0 w-20 text-right ${e.amount < 0 ? "text-gray-700" : e.status === "cancelled" || e.status === "expired" ? "text-gray-400 line-through" : "text-violet-700"}`}>
                    {e.amount < 0 ? `−${fmt.brl(-e.amount)}` : `+${fmt.brl(e.amount)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
