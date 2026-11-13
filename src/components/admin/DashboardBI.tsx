"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, AlertCircle, Info, ArrowRight, BarChart3, CalendarDays, CreditCard, DollarSign,
  Eye, Package, Percent, RefreshCw, ShoppingBag, Table2, TrendingUp, UserPlus, XCircle, Wallet,
} from "lucide-react";
import TrendChart from "@/components/admin/charts/TrendChart";
import { BarList, ChartCard, Funnel, Heatmap, KpiCard, SegmentedBar } from "@/components/admin/charts/Charts";
import { fmt } from "@/components/admin/charts/theme";

interface KPI { cur: number; prev: number }
interface Group { label: string; value: number; count: number }
interface DashboardData {
  period: { start: string; end: string; monthly: boolean };
  buckets: { label: string; short: string; revenue: number; prevRevenue: number; orders: number; items: number; ticket: number; cancelled: number }[];
  kpis: Record<"revenue" | "netRevenue" | "orders" | "ticket" | "items" | "sessions" | "conversion" | "newCustomers" | "cancelRate" | "grossProfit", KPI>;
  byStatus: Group[];
  byPayment: Group[];
  byState: Group[];
  byChannel: Group[];
  byCategory: { label: string; value: number; qty: number }[];
  topProducts: { label: string; value: number; qty: number }[];
  heatmap: number[][];
  funnel: { label: string; value: number }[];
  alerts: { key: string; count: number; title: string; description: string; href: string; severity: "critical" | "warning" | "info" }[];
}

const PRESETS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: 365, label: "12 meses" },
];

type Metric = "revenue" | "orders" | "ticket";
const METRICS: { key: Metric; label: string }[] = [
  { key: "revenue", label: "Faturamento" },
  { key: "orders", label: "Pedidos" },
  { key: "ticket", label: "Ticket médio" },
];

const SEVERITY = {
  critical: { icon: AlertCircle, ring: "ring-red-200", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Urgente" },
  warning: { icon: AlertTriangle, ring: "ring-amber-200", bg: "bg-amber-50", text: "text-amber-800", dot: "bg-amber-500", label: "Atenção" },
  info: { icon: Info, ring: "ring-blue-200", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Aviso" },
};

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`img-skeleton rounded-2xl ${className}`} />;
}

export default function DashboardBI({ storeName }: { storeName?: string | null }) {
  const [days, setDays] = useState<number | null>(30);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [metric, setMetric] = useState<Metric>("revenue");
  const [showTable, setShowTable] = useState(false);

  const qs = days ? `days=${days}` : from ? `from=${from}&to=${to || from}` : null;
  const requestKey = `${qs}#${reloadTick}`;
  const loading = loadedKey !== requestKey;
  const load = () => setReloadTick((n) => n + 1);

  useEffect(() => {
    if (!qs) return;
    let cancelled = false;
    fetch(`/api/admin/dashboard?${qs}`)
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar os dados");
        return res.json();
      })
      .then((json: DashboardData) => {
        if (cancelled) return;
        setData(json);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Erro"))
      .finally(() => !cancelled && setLoadedKey(requestKey));
    return () => { cancelled = true; };
  }, [qs, requestKey]);

  const trend = useMemo(() => {
    if (!data) return [];
    return data.buckets.map((b) => ({
      label: b.label,
      short: b.short,
      value: metric === "revenue" ? b.revenue : metric === "orders" ? b.orders : b.ticket,
      previous: metric === "revenue" ? b.prevRevenue : undefined,
    }));
  }, [data, metric]);

  const metricFormat = metric === "orders" ? fmt.num : fmt.brl;
  const metricAxis = metric === "orders" ? fmt.numCompact : fmt.brlAxis;
  const k = data?.kpis;
  const spark = (key: "revenue" | "orders" | "ticket" | "items" | "cancelled") => {
    const vals = data?.buckets.map((b) => b[key]) ?? [];
    // Sparkline com no máximo ~16 pontos (agrupa os dias)
    if (vals.length <= 16) return vals;
    const size = Math.ceil(vals.length / 16);
    const out: number[] = [];
    for (let i = 0; i < vals.length; i += size) out.push(vals.slice(i, i + size).reduce((s, v) => s + v, 0));
    return out;
  };

  const periodLabel = data
    ? `${new Date(data.period.start).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} – ${new Date(data.period.end).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
    : "";

  return (
    <div className="space-y-6">
      {/* Cabeçalho + filtros (uma linha só, acima de todos os gráficos) */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Visão geral</h1>
          <p className="text-sm text-gray-500 mt-1">
            Como {storeName ? <b className="font-medium text-gray-700">{storeName}</b> : "sua loja"} está indo
            {periodLabel && <> · <span className="tabular-nums">{periodLabel}</span></>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-white p-1 ring-1 ring-gray-200 shadow-sm">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                onClick={() => { setDays(p.days); setFrom(""); setTo(""); }}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-lg transition-all ${
                  days === p.days ? "bg-gray-900 text-white shadow" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className={`inline-flex items-center gap-1.5 rounded-xl bg-white px-2.5 py-1.5 ring-1 shadow-sm ${days ? "ring-gray-200" : "ring-gray-900"}`}>
            <CalendarDays size={14} className="text-gray-400" />
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => { setFrom(e.target.value); if (e.target.value) setDays(null); }}
              className="text-[13px] bg-transparent outline-none text-gray-700 w-[118px]"
              aria-label="Data inicial"
            />
            <span className="text-gray-300">–</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => { setTo(e.target.value); if (from) setDays(null); }}
              className="text-[13px] bg-transparent outline-none text-gray-700 w-[118px]"
              aria-label="Data final"
            />
          </div>
          <button
            onClick={load}
            className="p-2 rounded-xl bg-white ring-1 ring-gray-200 shadow-sm text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Atualizar"
            title="Atualizar"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3 ring-1 ring-red-200">{error}</div>}

      {/* Precisa de atenção */}
      {data && data.alerts.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Precisa da sua atenção</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {data.alerts.map((a) => {
              const s = SEVERITY[a.severity];
              const Icon = s.icon;
              return (
                <Link
                  key={a.key}
                  href={a.href}
                  className={`group flex items-start gap-3 rounded-2xl ${s.bg} ring-1 ${s.ring} p-4 hover:shadow-md hover:-translate-y-0.5 transition-all`}
                >
                  <Icon size={18} className={`${s.text} shrink-0 mt-0.5`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${s.text}`}>
                      <span className="tabular-nums text-base mr-1">{a.count}</span>
                      {a.title}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{a.description}</p>
                  </div>
                  <ArrowRight size={16} className={`${s.text} opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5`} />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* KPIs */}
      {!k ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[118px]" />)}
        </div>
      ) : (
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <KpiCard icon={DollarSign} label="Faturamento" value={fmt.brlCompact(k.revenue.cur)} current={k.revenue.cur} previous={k.revenue.prev} spark={spark("revenue")} hint="Soma dos pedidos pagos no período" />
          <KpiCard icon={ShoppingBag} label="Pedidos pagos" value={fmt.num(k.orders.cur)} current={k.orders.cur} previous={k.orders.prev} spark={spark("orders")} />
          <KpiCard icon={CreditCard} label="Ticket médio" value={fmt.brl(k.ticket.cur)} current={k.ticket.cur} previous={k.ticket.prev} spark={spark("ticket")} />
          <KpiCard icon={Wallet} label="Lucro bruto" value={fmt.brlCompact(k.grossProfit.cur)} current={k.grossProfit.cur} previous={k.grossProfit.prev} hint="Faturamento menos o preço de custo dos produtos (produtos sem custo cadastrado contam como custo zero)" />
          <KpiCard icon={Eye} label="Visitas" value={fmt.num(k.sessions.cur)} current={k.sessions.cur} previous={k.sessions.prev} />
          <KpiCard icon={Percent} label="Conversão" value={fmt.pct(k.conversion.cur, 2)} current={k.conversion.cur} previous={k.conversion.prev} hint="Pedidos pagos ÷ visitas" />
          <KpiCard icon={UserPlus} label="Novos clientes" value={fmt.num(k.newCustomers.cur)} current={k.newCustomers.cur} previous={k.newCustomers.prev} hint="Contas criadas no período" />
          <KpiCard icon={XCircle} label="Cancelamentos" value={fmt.pct(k.cancelRate.cur)} current={k.cancelRate.cur} previous={k.cancelRate.prev} spark={spark("cancelled")} invert hint="% dos pedidos criados que foram cancelados" />
        </div>
      )}

      {/* Tendência + status */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          className="xl:col-span-2"
          title={`${METRICS.find((m) => m.key === metric)?.label} ${data?.period.monthly ? "por mês" : "por dia"}`}
          subtitle={metric === "revenue" ? "Comparado com o período anterior de mesmo tamanho" : "Somente pedidos pagos"}
          action={
            <div className="flex items-center gap-1">
              <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
                {METRICS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMetric(m.key)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${metric === m.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowTable((v) => !v)}
                className={`p-1.5 rounded-lg transition-colors ${showTable ? "bg-gray-900 text-white" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`}
                title={showTable ? "Ver gráfico" : "Ver tabela"}
                aria-label={showTable ? "Ver gráfico" : "Ver tabela"}
              >
                {showTable ? <BarChart3 size={15} /> : <Table2 size={15} />}
              </button>
            </div>
          }
        >
          {!data ? (
            <Skeleton className="h-[260px]" />
          ) : showTable ? (
            <div className="max-h-[300px] overflow-auto -mx-1">
              <table className="w-full text-[13px] tabular-nums">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 px-1 font-medium">Período</th>
                    <th className="py-2 px-1 font-medium text-right">Faturamento</th>
                    <th className="py-2 px-1 font-medium text-right">Anterior</th>
                    <th className="py-2 px-1 font-medium text-right">Pedidos</th>
                    <th className="py-2 px-1 font-medium text-right">Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {data.buckets.map((b) => (
                    <tr key={b.label} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-1.5 px-1 text-gray-700">{b.label}</td>
                      <td className="py-1.5 px-1 text-right font-medium text-gray-900">{fmt.brl(b.revenue)}</td>
                      <td className="py-1.5 px-1 text-right text-gray-400">{fmt.brl(b.prevRevenue)}</td>
                      <td className="py-1.5 px-1 text-right">{b.orders}</td>
                      <td className="py-1.5 px-1 text-right">{fmt.brl(b.ticket)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <TrendChart data={trend} format={metricFormat} formatAxis={metricAxis} />
          )}
        </ChartCard>

        <ChartCard title="Pedidos por status" subtitle="Todos os pedidos criados no período">
          {!data ? <Skeleton className="h-[200px]" /> : <SegmentedBar segments={data.byStatus.map((s) => ({ label: s.label, value: s.value }))} />}
        </ChartCard>
      </div>

      {/* Produtos, categorias, pagamento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <ChartCard title="Produtos mais vendidos" subtitle="Por faturamento">
          {!data ? <Skeleton className="h-[240px]" /> : (
            <BarList items={data.topProducts.map((p) => ({ label: p.label, value: p.value, sub: `${p.qty} un.` }))} />
          )}
        </ChartCard>
        <ChartCard title="Vendas por categoria" subtitle="Por faturamento">
          {!data ? <Skeleton className="h-[240px]" /> : (
            <BarList items={data.byCategory.map((c) => ({ label: c.label, value: c.value, sub: `${c.qty} un.` }))} />
          )}
        </ChartCard>
        <ChartCard title="Formas de pagamento" subtitle="Faturamento por meio de pagamento" className="lg:col-span-2 xl:col-span-1">
          {!data ? <Skeleton className="h-[200px]" /> : (
            <SegmentedBar segments={data.byPayment.map((p) => ({ label: p.label, value: p.value }))} format={fmt.brlCompact} />
          )}
        </ChartCard>
      </div>

      {/* Horários + funil */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard className="xl:col-span-2" title="Quando seus clientes compram" subtitle="Pedidos pagos por dia da semana e hora (horário de Brasília)">
          {!data ? <Skeleton className="h-[220px]" /> : <Heatmap matrix={data.heatmap} />}
        </ChartCard>
        <ChartCard title="Funil de conversão" subtitle="Visitantes únicos em cada etapa">
          {!data ? <Skeleton className="h-[240px]" /> : <Funnel steps={data.funnel} />}
        </ChartCard>
      </div>

      {/* Geografia + canais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Vendas por estado" subtitle="Por faturamento">
          {!data ? <Skeleton className="h-[240px]" /> : (
            <BarList items={data.byState.map((s) => ({ label: s.label, value: s.value, sub: `${s.count} ped.` }))} />
          )}
        </ChartCard>
        <ChartCard
          title="De onde vêm as vendas"
          subtitle="Canal de origem do cliente"
          action={<Link href="/admin/relatorios" className="text-xs font-medium text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">Relatório completo <ArrowRight size={12} /></Link>}
        >
          {!data ? <Skeleton className="h-[240px]" /> : (
            <BarList items={data.byChannel.map((s) => ({ label: s.label, value: s.value, sub: `${s.count} ped.` }))} />
          )}
        </ChartCard>
      </div>

      {data && k && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <TrendingUp size={12} /> Faturamento líquido de taxas: <b className="text-gray-600 tabular-nums">{fmt.brl(k.netRevenue.cur)}</b>
          <span className="mx-1">·</span>
          <Package size={12} /> {fmt.num(k.items.cur)} peças vendidas
        </p>
      )}
    </div>
  );
}
