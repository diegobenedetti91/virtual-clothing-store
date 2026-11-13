"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, CreditCard, DollarSign, Info, Loader2, Percent, RefreshCw, RotateCcw, Wallet } from "lucide-react";
import { ChartCard, KpiCard, SegmentedBar } from "@/components/admin/charts/Charts";
import DataTable, { type Column } from "@/components/admin/charts/DataTable";
import { fmt } from "@/components/admin/charts/theme";

interface Row {
  id: string;
  orderNumber: string;
  customerName: string;
  createdAt: string;
  status: string;
  method: string;
  group: string;
  gateway: string | null;
  total: number;
  fee: number | null;
  feeRate: number | null;
  refunded: number;
  net: number;
  missingFee: boolean;
}
interface MethodRow { label: string; count: number; gross: number; fees: number; feeRate: number | null; feeKnownCount: number }
interface Data {
  rows: Row[];
  summary: { orders: number; gross: number; fees: number; refunds: number; net: number; ticket: number; avgFeeRate: number | null; missingFees: number; unknownFeeOrders: number };
  byMethod: MethodRow[];
}

const DAY = 86400000;
const ymd = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const PRESETS = [
  { key: "7", label: "7 dias", days: 7 },
  { key: "30", label: "30 dias", days: 30 },
  { key: "90", label: "90 dias", days: 90 },
  { key: "month", label: "Este mês", days: 0 },
  { key: "all", label: "Tudo", days: -1 },
];

export default function PagamentosPage() {
  const [preset, setPreset] = useState("30");
  const [from, setFrom] = useState(() => ymd(new Date(Date.now() - 29 * DAY)));
  const [to, setTo] = useState(() => ymd(new Date()));
  const [data, setData] = useState<Data | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const query = new URLSearchParams({ ...(from ? { dateFrom: from } : {}), ...(to ? { dateTo: to } : {}) }).toString();
  const key = `${query}#${tick}`;
  const loading = loadedKey !== key;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/relatorios?${query}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.summary) setData(d); })
      .finally(() => !cancelled && setLoadedKey(key));
    return () => { cancelled = true; };
  }, [query, key]);

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setPreset(p.key);
    const now = new Date();
    if (p.days === -1) { setFrom(""); setTo(""); }
    else if (p.days === 0) { setFrom(ymd(new Date(now.getFullYear(), now.getMonth(), 1))); setTo(ymd(now)); }
    else { setFrom(ymd(new Date(now.getTime() - (p.days - 1) * DAY))); setTo(ymd(now)); }
  };

  const syncFees = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/admin/relatorios", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erro ao buscar taxas");
      setSyncMsg({
        ok: d.failed === 0,
        text: `${d.updated} pedido(s) atualizado(s) com a taxa real do Mercado Pago${d.failed ? ` · ${d.failed} sem resposta` : ""}${d.remaining ? ` · faltam ${d.remaining} (clique de novo)` : ""}.`,
      });
      setTick((n) => n + 1);
    } catch (e) {
      setSyncMsg({ ok: false, text: e instanceof Error ? e.message : "Erro" });
    } finally {
      setSyncing(false);
    }
  };

  const columns: Column<Row>[] = useMemo(() => [
    { key: "orderNumber", header: "Pedido", value: (r) => r.orderNumber, className: "font-semibold text-gray-900" },
    { key: "customerName", header: "Cliente", value: (r) => r.customerName, className: "text-gray-700 max-w-[160px] truncate" },
    { key: "createdAt", header: "Data", value: (r) => r.createdAt, render: (r) => new Date(r.createdAt).toLocaleDateString("pt-BR"), className: "text-gray-500" },
    { key: "method", header: "Forma", value: (r) => r.method, render: (r) => <span className="inline-flex px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs">{r.method}</span> },
    { key: "total", header: "Valor", value: (r) => r.total, render: (r) => fmt.brl(r.total), align: "right", className: "text-gray-900" },
    {
      key: "fee", header: "Taxa", value: (r) => r.fee, align: "right",
      render: (r) => r.fee != null
        ? <span className="text-red-600">−{fmt.brl(r.fee)} <span className="text-gray-400 text-xs">{r.feeRate != null ? fmt.pct(r.feeRate, 2) : ""}</span></span>
        : <span className="text-gray-300" title={r.missingFee ? "Taxa ainda não buscada no Mercado Pago" : "Este gateway não informa a taxa"}>{r.missingFee ? "pendente" : "—"}</span>,
    },
    { key: "refunded", header: "Estorno", value: (r) => r.refunded, render: (r) => (r.refunded ? <span className="text-amber-700">−{fmt.brl(r.refunded)}</span> : <span className="text-gray-300">—</span>), align: "right" },
    { key: "net", header: "Líquido", value: (r) => r.net, render: (r) => fmt.brl(r.net), align: "right", className: "font-semibold text-emerald-700" },
  ], []);

  const s = data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Pagamentos e taxas</h1>
          <p className="text-sm text-gray-500 mt-1">Quanto entrou, quanto ficou com os gateways e quanto realmente sobra para a loja.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-white p-1 ring-1 ring-gray-200 shadow-sm">
            {PRESETS.map((p) => (
              <button key={p.key} onClick={() => applyPreset(p)} className={`px-3 py-1.5 text-[13px] font-medium rounded-lg transition ${preset === p.key ? "bg-gray-900 text-white shadow" : "text-gray-600 hover:bg-gray-100"}`}>{p.label}</button>
            ))}
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-white px-2.5 py-1.5 ring-1 ring-gray-200 shadow-sm">
            <CalendarDays size={14} className="text-gray-400" />
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} className="text-[13px] bg-transparent outline-none w-[118px]" aria-label="De" />
            <span className="text-gray-300">–</span>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} className="text-[13px] bg-transparent outline-none w-[118px]" aria-label="Até" />
          </div>
          <button onClick={() => setTick((n) => n + 1)} className="p-2 rounded-xl bg-white ring-1 ring-gray-200 shadow-sm text-gray-500 hover:text-gray-900" aria-label="Atualizar">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Taxas pendentes */}
      {s && s.missingFees > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-900 flex-1">
            <b>{s.missingFees}</b> pedido(s) do Mercado Pago estão sem a taxa registrada. Até agora a loja não gravava a taxa (lia um campo que o Mercado Pago não envia) — busque as taxas reais com um clique.
          </p>
          <button onClick={syncFees} disabled={syncing} className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-60">
            {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Buscar taxas no Mercado Pago
          </button>
        </div>
      )}
      {syncMsg && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${syncMsg.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
          {syncMsg.ok ? <CheckCircle2 size={16} /> : <Info size={16} />} {syncMsg.text}
        </div>
      )}

      {/* KPIs */}
      {!s ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-[110px]" />)}</div>
      ) : (
        <div className={`grid grid-cols-2 lg:grid-cols-5 gap-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <KpiCard icon={DollarSign} label="Receita bruta" value={fmt.brlCompact(s.gross)} current={s.gross} hint={`${s.orders} pedidos pagos`} />
          <KpiCard icon={CreditCard} label="Taxas dos gateways" value={`−${fmt.brl(s.fees)}`} current={s.fees} hint="Somente taxas informadas pelo gateway" />
          <KpiCard icon={Percent} label="Taxa média" value={s.avgFeeRate != null ? fmt.pct(s.avgFeeRate, 2) : "—"} current={s.avgFeeRate ?? 0} hint="Sobre os pedidos com taxa conferida" />
          <KpiCard icon={RotateCcw} label="Estornos" value={s.refunds ? `−${fmt.brl(s.refunds)}` : fmt.brl(0)} current={s.refunds} hint="Devoluções aprovadas" />
          <KpiCard icon={Wallet} label="Líquido para a loja" value={fmt.brlCompact(s.net)} current={s.net} hint="Bruto − taxas − estornos" />
        </div>
      )}

      {s && s.unknownFeeOrders > s.missingFees && (
        <p className="text-xs text-gray-500 flex items-center gap-1.5">
          <Info size={13} /> {s.unknownFeeOrders - s.missingFees} pedido(s) de NuPay, Infinity Pay ou WhatsApp não têm taxa informada pelo gateway — confira no painel de cada um.
        </p>
      )}

      {data && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <ChartCard title="Receita por forma de pagamento" subtitle="Participação no faturamento do período">
            <SegmentedBar segments={data.byMethod.map((m) => ({ label: m.label, value: m.gross }))} format={fmt.brlCompact} />
          </ChartCard>
          <ChartCard title="Quanto cada forma custa" subtitle="Taxa média cobrada pelo gateway" className="xl:col-span-2">
            {data.byMethod.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sem pedidos pagos no período</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-[13px] tabular-nums">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="py-2 px-2 font-medium">Forma</th>
                      <th className="py-2 px-2 font-medium text-right">Pedidos</th>
                      <th className="py-2 px-2 font-medium text-right">Bruto</th>
                      <th className="py-2 px-2 font-medium text-right">Taxas</th>
                      <th className="py-2 px-2 font-medium">Taxa média</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byMethod.map((m) => {
                      const max = Math.max(...data.byMethod.map((x) => x.feeRate ?? 0), 1);
                      return (
                        <tr key={m.label} className="border-b border-gray-50 last:border-0">
                          <td className="py-2.5 px-2 font-medium text-gray-900">{m.label}</td>
                          <td className="py-2.5 px-2 text-right text-gray-600">{m.count}</td>
                          <td className="py-2.5 px-2 text-right text-gray-900">{fmt.brl(m.gross)}</td>
                          <td className="py-2.5 px-2 text-right text-red-600">{m.feeKnownCount ? `−${fmt.brl(m.fees)}` : <span className="text-gray-300">—</span>}</td>
                          <td className="py-2.5 px-2 w-[35%]">
                            {m.feeRate != null ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-[#eb6834]" style={{ width: `${(m.feeRate / max) * 100}%` }} /></div>
                                <span className="w-12 text-right text-gray-900 font-medium">{fmt.pct(m.feeRate, 2)}</span>
                              </div>
                            ) : <span className="text-xs text-gray-400">não informada</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        </div>
      )}

      {data && (
        <ChartCard title="Pedidos pagos" subtitle="Clique no cabeçalho para ordenar · exporte para o Excel">
          <DataTable rows={data.rows} columns={columns} rowKey={(r) => r.id} defaultSort={{ key: "createdAt", dir: "desc" }} searchable exportName={`pagamentos-${from || "inicio"}-${to || "hoje"}`} pageSize={15} />
        </ChartCard>
      )}
    </div>
  );
}
