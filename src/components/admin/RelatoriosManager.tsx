"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, ShoppingCart, DollarSign, MapPin, Tag, ChevronDown, XCircle, Percent, Calendar, Globe, Megaphone, Wallet, RotateCcw, BarChart3, Coins, Scale, TrendingDown, Sparkles } from "lucide-react";
import { Button } from "@/components/admin/ui/Button";
import { BarList, ChartCard, ColumnChart, KpiCard } from "@/components/admin/charts/Charts";
import DataTable, { type Column } from "@/components/admin/charts/DataTable";
import { fmt } from "@/components/admin/charts/theme";
import { useSearchParams } from "next/navigation";
import InsightsPanels, { type InsightsTab } from "@/components/admin/InsightsPanels";

interface MonthData { month: number; label: string; revenue: number; orders: number }
interface StateData { state: string; revenue: number; orders: number }
interface CategoryData { category: string; revenue: number; items: number }
interface CancelData { reason: string; count: number; total: number }
interface Summary { revenue: number; orders: number; ticket: number; cancelled: number }
interface ProductMarginData {
  productId: string; name: string; revenue: number; cost: number | null;
  profit: number | null; margin: number | null; quantity: number;
}
interface OrderMarginData {
  orderNumber: string; customerName: string; createdAt: string;
  revenue: number; shipping: number; cost: number | null; profit: number | null; margin: number | null;
}

interface SourceData { channel: string; visits: number; orders: number; revenue: number; conversion: number | null }
interface CampaignData { source: string; medium: string; campaign: string; visits: number; orders: number; revenue: number }

interface AnalyticsData {
  year: number;
  month: number;
  years: number[];
  allStates: string[];
  monthlyRevenue: MonthData[];
  byState: StateData[];
  byCategory: CategoryData[];
  byCancelReason: CancelData[];
  byProduct: ProductMarginData[];
  byOrder: OrderMarginData[];
  bySource: SourceData[];
  byCampaign: CampaignData[];
  summary: Summary;
}

const STATUS_OPTIONS = [
  { value: "DELIVERED,RETIRADO", label: "Entregues e Retirados" },
  { value: "CONFIRMED,SHIPPED,DELIVERED,RETIRADO", label: "Confirmados + Enviados + Entregues + Retirados" },
  { value: "PENDING,CONFIRMED,SHIPPED,DELIVERED,RETIRADO", label: "Todos (exceto cancelados)" },
];

const MONTHS = [
  { value: 0, label: "Todo o ano" },
  { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" }, { value: 3, label: "Março" },
  { value: 4, label: "Abril" }, { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
  { value: 7, label: "Julho" }, { value: 8, label: "Agosto" }, { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" }, { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
];

type Tab = "vendas" | "lucro" | "marketing" | "cancelamentos" | InsightsTab;
const INSIGHT_TABS: InsightsTab[] = ["real", "perdas", "ganhos"];
const TABS: { key: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: "vendas", label: "Vendas", icon: BarChart3 },
  { key: "real", label: "Lucro real", icon: Scale },
  { key: "lucro", label: "Margem por produto", icon: Coins },
  { key: "perdas", label: "Perdas", icon: TrendingDown },
  { key: "ganhos", label: "Produtos e clientes", icon: Sparkles },
  { key: "marketing", label: "Marketing e origem", icon: Megaphone },
  { key: "cancelamentos", label: "Cancelamentos", icon: XCircle },
];

function MarginPill({ margin }: { margin: number | null }) {
  if (margin == null) return <span className="text-gray-300 text-xs">sem custo</span>;
  const tone = margin >= 20 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : margin >= 0 ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-red-50 text-red-700 ring-red-200";
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${tone}`}>{fmt.pct(margin)}</span>;
}

const profitCell = (v: number | null) =>
  v == null ? <span className="text-gray-300">—</span> : <span className={`font-semibold ${v >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt.brl(v)}</span>;

function Select({ value, onChange, children, label }: { value: string | number; onChange: (v: string) => void; children: React.ReactNode; label: string }) {
  return (
    <label className="relative" aria-label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 text-[13px] text-gray-900 bg-white transition appearance-none cursor-pointer"
      >
        {children}
      </select>
      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </label>
  );
}

const DEFAULT_STATUSES = "DELIVERED,RETIRADO";

export default function RelatoriosManager() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(0);
  const [filterMode, setFilterMode] = useState<"period" | "range">("period");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);
  const [stateFilter, setStateFilter] = useState("");
  const searchParams = useSearchParams();
  // ?tab=real abre direto na aba (link do dashboard)
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get("tab");
    return TABS.some((x) => x.key === t) ? (t as Tab) : "vendas";
  });

  // Período em datas (YYYY-MM-DD) para as abas de análise
  const insightRange = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const today = new Date().toISOString().slice(0, 10);
    if (filterMode === "range") return { from: dateFrom || "2000-01-01", to: dateTo || today };
    if (month > 0) {
      const last = new Date(year, month, 0).getDate();
      return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
    }
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }, [filterMode, dateFrom, dateTo, year, month]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ statuses });
    if (filterMode === "range") {
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
    } else {
      params.set("year", String(year));
      params.set("month", String(month));
    }
    if (stateFilter) params.set("state", stateFilter);
    return params.toString();
  }, [year, month, filterMode, dateFrom, dateTo, statuses, stateFilter]);
  const loading = loadedKey !== query;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/analytics?${query}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((json: AnalyticsData) => {
        if (cancelled) return;
        setData(json);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoadedKey(query));
    return () => { cancelled = true; };
  }, [query]);

  const inputClass = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-900 bg-white transition cursor-pointer";
  const hasActiveFilters = stateFilter || statuses !== DEFAULT_STATUSES || (filterMode === "range" && (dateFrom || dateTo)) || month !== 0;

  const periodTitle =
    filterMode === "range" && (dateFrom || dateTo)
      ? `${dateFrom ? new Date(dateFrom + "T12:00:00").toLocaleDateString("pt-BR") : "início"} até ${dateTo ? new Date(dateTo + "T12:00:00").toLocaleDateString("pt-BR") : "hoje"}`
      : month > 0
        ? `${MONTHS[month].label} de ${year}`
        : String(year);

  // Lucro bruto do período (somente produtos com custo cadastrado)
  const profit = useMemo(() => {
    if (!data) return null;
    const withCost = data.byProduct.filter((p) => p.cost != null);
    const revenue = withCost.reduce((s, p) => s + p.revenue, 0);
    const value = withCost.reduce((s, p) => s + (p.profit ?? 0), 0);
    const coverage = data.byProduct.length ? (withCost.length / data.byProduct.length) * 100 : 0;
    return { value, margin: revenue ? (value / revenue) * 100 : null, coverage, missing: data.byProduct.length - withCost.length };
  }, [data]);

  const productCols: Column<ProductMarginData>[] = [
    { key: "name", header: "Produto", value: (r) => r.name, className: "font-medium text-gray-900 max-w-[240px] truncate" },
    { key: "quantity", header: "Qtd.", value: (r) => r.quantity, align: "right" },
    { key: "revenue", header: "Receita", value: (r) => r.revenue, render: (r) => fmt.brl(r.revenue), align: "right", className: "text-gray-900" },
    { key: "cost", header: "Custo", value: (r) => r.cost, render: (r) => (r.cost != null ? fmt.brl(r.cost) : <span className="text-gray-300">—</span>), align: "right" },
    { key: "profit", header: "Lucro", value: (r) => r.profit, render: (r) => profitCell(r.profit), align: "right" },
    { key: "margin", header: "Margem", value: (r) => r.margin, render: (r) => <MarginPill margin={r.margin} />, align: "right" },
  ];
  const orderCols: Column<OrderMarginData>[] = [
    { key: "orderNumber", header: "Pedido", value: (r) => r.orderNumber, className: "font-mono text-xs font-semibold text-gray-700" },
    { key: "customerName", header: "Cliente", value: (r) => r.customerName, className: "text-gray-700 max-w-[160px] truncate" },
    { key: "createdAt", header: "Data", value: (r) => r.createdAt, render: (r) => new Date(r.createdAt).toLocaleDateString("pt-BR"), className: "text-gray-500" },
    { key: "revenue", header: "Receita", value: (r) => r.revenue, render: (r) => fmt.brl(r.revenue), align: "right", className: "text-gray-900" },
    { key: "shipping", header: "Frete", value: (r) => r.shipping, render: (r) => (r.shipping ? `−${fmt.brl(r.shipping)}` : <span className="text-gray-300">—</span>), align: "right", className: "text-gray-500" },
    { key: "cost", header: "Custo", value: (r) => r.cost, render: (r) => (r.cost != null ? fmt.brl(r.cost) : <span className="text-gray-300">—</span>), align: "right" },
    { key: "profit", header: "Lucro", value: (r) => r.profit, render: (r) => profitCell(r.profit), align: "right" },
    { key: "margin", header: "Margem", value: (r) => r.margin, render: (r) => <MarginPill margin={r.margin} />, align: "right" },
  ];
  const stateCols: Column<StateData>[] = [
    { key: "state", header: "Estado", value: (r) => r.state, className: "font-medium text-gray-900" },
    { key: "orders", header: "Pedidos", value: (r) => r.orders, align: "right" },
    { key: "revenue", header: "Faturamento", value: (r) => r.revenue, render: (r) => fmt.brl(r.revenue), align: "right", className: "text-gray-900 font-semibold" },
    { key: "ticket", header: "Ticket médio", value: (r) => (r.orders ? r.revenue / r.orders : 0), render: (r) => fmt.brl(r.orders ? r.revenue / r.orders : 0), align: "right" },
    { key: "share", header: "% do total", value: (r) => (data?.summary.revenue ? (r.revenue / data.summary.revenue) * 100 : 0), render: (r) => fmt.pct(data?.summary.revenue ? (r.revenue / data.summary.revenue) * 100 : 0), align: "right", className: "text-gray-500" },
  ];
  const sourceCols: Column<SourceData>[] = [
    { key: "channel", header: "Canal", value: (r) => r.channel, className: "font-medium text-gray-900" },
    { key: "visits", header: "Visitas", value: (r) => r.visits, render: (r) => fmt.num(r.visits), align: "right" },
    { key: "orders", header: "Pedidos", value: (r) => r.orders, align: "right" },
    { key: "conversion", header: "Conversão", value: (r) => r.conversion, render: (r) => (r.conversion != null ? fmt.pct(r.conversion) : <span className="text-gray-300">—</span>), align: "right" },
    { key: "revenue", header: "Faturamento", value: (r) => r.revenue, render: (r) => fmt.brl(r.revenue), align: "right", className: "text-gray-900 font-semibold" },
    { key: "ticket", header: "Ticket médio", value: (r) => (r.orders ? r.revenue / r.orders : null), render: (r) => (r.orders ? fmt.brl(r.revenue / r.orders) : <span className="text-gray-300">—</span>), align: "right" },
  ];
  const campaignCols: Column<CampaignData>[] = [
    { key: "campaign", header: "Campanha", value: (r) => r.campaign, className: "font-medium text-gray-900 max-w-[220px] truncate" },
    { key: "source", header: "Origem / mídia", value: (r) => `${r.source} / ${r.medium}`, className: "text-gray-500" },
    { key: "visits", header: "Visitas", value: (r) => r.visits, align: "right" },
    { key: "orders", header: "Pedidos", value: (r) => r.orders, align: "right" },
    { key: "conversion", header: "Conversão", value: (r) => (r.visits ? (r.orders / r.visits) * 100 : null), render: (r) => (r.visits ? fmt.pct((r.orders / r.visits) * 100) : <span className="text-gray-300">—</span>), align: "right" },
    { key: "revenue", header: "Faturamento", value: (r) => r.revenue, render: (r) => fmt.brl(r.revenue), align: "right", className: "text-gray-900 font-semibold" },
  ];

  const cancelledTotal = data?.byCancelReason.reduce((s, r) => s + r.total, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Filtros — uma linha, acima de tudo */}
      <div className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
          <button
            type="button"
            onClick={() => setFilterMode("period")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${filterMode === "period" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
          >
            Ano / mês
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("range")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all inline-flex items-center gap-1 ${filterMode === "range" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
          >
            <Calendar size={12} /> Intervalo
          </button>
        </div>

        {filterMode === "period" ? (
          <>
            <Select label="Ano" value={year} onChange={(v) => setYear(Number(v))}>
              {(data?.years ?? [year]).map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
            <Select label="Mês" value={month} onChange={(v) => setMonth(Number(v))}>
              {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </>
        ) : (
          <>
            <input type="date" aria-label="Data início" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
            <span className="text-gray-300">–</span>
            <input type="date" aria-label="Data fim" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
          </>
        )}

        <Select label="Status dos pedidos" value={statuses} onChange={setStatuses}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>

        {(data?.allStates ?? []).length > 1 && (
          <Select label="Estado" value={stateFilter} onChange={setStateFilter}>
            <option value="">Todos os estados</option>
            {(data?.allStates ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        )}

        <div className="ml-auto flex items-center gap-2">
          {loading && <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="xs"
              icon={RotateCcw}
              onClick={() => { setStateFilter(""); setStatuses(DEFAULT_STATUSES); setFilterMode("period"); setDateFrom(""); setDateTo(""); setMonth(0); }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {failed && !data && <div className="text-center py-20 text-gray-400">Erro ao carregar dados.</div>}

      {!data ? (
        !failed && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-[110px]" />)}
          </div>
        )
      ) : (
        <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard icon={DollarSign} label="Faturamento" value={fmt.brlCompact(data.summary.revenue)} current={data.summary.revenue} />
            <KpiCard icon={ShoppingCart} label="Pedidos" value={fmt.num(data.summary.orders)} current={data.summary.orders} />
            <KpiCard icon={TrendingUp} label="Ticket médio" value={fmt.brl(data.summary.ticket)} current={data.summary.ticket} hint="Valor dos produtos por pedido, já com descontos e sem o frete" />
            <KpiCard
              icon={Wallet}
              label="Lucro bruto"
              value={profit ? fmt.brlCompact(profit.value) : "—"}
              current={profit?.value ?? 0}
              hint={profit?.missing ? `${profit.missing} produto(s) sem preço de custo não entram no cálculo` : "Receita menos custo dos produtos"}
            />
            <KpiCard icon={XCircle} label="Cancelamentos" value={fmt.num(data.summary.cancelled)} current={data.summary.cancelled} />
          </div>

          {/* Abas */}
          <div className="border-b border-gray-200 flex gap-1 overflow-x-auto [scrollbar-width:none]">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${tab === key ? "text-gray-900" : "text-gray-500 hover:text-gray-800"}`}
              >
                <Icon size={15} /> {label}
                {key === "cancelamentos" && data.summary.cancelled > 0 && (
                  <span className="ml-0.5 text-[11px] bg-gray-100 text-gray-600 rounded-full px-1.5 tabular-nums">{data.summary.cancelled}</span>
                )}
                <span className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gray-900 transition-transform origin-center ${tab === key ? "scale-x-100" : "scale-x-0"}`} />
              </button>
            ))}
          </div>

          <div key={tab} className="space-y-4 animate-fade-up [animation-duration:0.4s]">
            {INSIGHT_TABS.includes(tab as InsightsTab) && (
              <>
                <p className="text-xs text-gray-500">Esta análise usa todos os pedidos pagos do período (o filtro de status e estado não se aplica aqui).</p>
                <InsightsPanels tab={tab as InsightsTab} from={insightRange.from} to={insightRange.to} />
              </>
            )}
            {tab === "vendas" && (
              <>
                <ChartCard
                  title={filterMode === "range" && (dateFrom || dateTo) ? `Faturamento por mês de ${year}` : `Faturamento mensal — ${year}`}
                  subtitle="Passe o mouse sobre as colunas para ver o valor e o número de pedidos"
                >
                  <ColumnChart data={data.monthlyRevenue.map((m) => ({ label: m.label, value: m.revenue, sub: `${m.orders} pedido${m.orders === 1 ? "" : "s"}` }))} />
                </ChartCard>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard title="Vendas por estado" subtitle={periodTitle} action={<MapPin size={16} className="text-gray-300" />}>
                    <BarList items={data.byState.map((s) => ({ label: s.state, value: s.revenue, sub: `${s.orders} ped.` }))} />
                  </ChartCard>
                  <ChartCard title="Vendas por categoria" subtitle={periodTitle} action={<Tag size={16} className="text-gray-300" />}>
                    <BarList items={data.byCategory.map((c) => ({ label: c.category, value: c.revenue, sub: `${c.items} un.` }))} />
                  </ChartCard>
                </div>
                <ChartCard title="Detalhes por estado" subtitle="Clique no cabeçalho para ordenar">
                  <DataTable rows={data.byState} columns={stateCols} rowKey={(r) => r.state} defaultSort={{ key: "revenue", dir: "desc" }} exportName={`vendas-por-estado-${periodTitle}`} />
                </ChartCard>
              </>
            )}

            {tab === "lucro" && (
              <>
                {profit && profit.missing > 0 && (
                  <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3 text-[13px] text-amber-800">
                    <b>{profit.missing}</b> produto(s) vendidos no período não têm preço de custo cadastrado ({fmt.pct(100 - profit.coverage, 0)} dos produtos).
                    Cadastre o custo em <b>Produtos</b> para o lucro ficar completo.
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard title="Produtos que mais dão lucro" subtitle="Lucro bruto (receita − custo)">
                    <BarList
                      items={data.byProduct.filter((p) => p.profit != null && p.profit > 0).sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0)).map((p) => ({ label: p.name, value: p.profit ?? 0, sub: p.margin != null ? fmt.pct(p.margin, 0) : undefined }))}
                      empty="Cadastre o preço de custo dos produtos para ver o lucro"
                    />
                  </ChartCard>
                  <ChartCard title="Produtos que mais vendem" subtitle="Por quantidade de peças">
                    <BarList
                      items={[...data.byProduct].sort((a, b) => b.quantity - a.quantity).map((p) => ({ label: p.name, value: p.quantity, sub: fmt.brlCompact(p.revenue) }))}
                      format={(v) => `${fmt.num(v)} un.`}
                    />
                  </ChartCard>
                </div>
                <ChartCard title="Margem por produto" subtitle="Margem ≥ 20% em verde, entre 0 e 20% em amarelo, negativa em vermelho">
                  <DataTable rows={data.byProduct} columns={productCols} rowKey={(r) => r.productId} defaultSort={{ key: "profit", dir: "desc" }} searchable exportName={`margem-por-produto-${periodTitle}`} />
                </ChartCard>
                <ChartCard title="Margem por pedido" subtitle="Só pedidos em que todos os itens têm custo cadastrado mostram margem">
                  <DataTable rows={data.byOrder} columns={orderCols} rowKey={(r) => r.orderNumber} defaultSort={{ key: "createdAt", dir: "desc" }} searchable exportName={`margem-por-pedido-${periodTitle}`} />
                </ChartCard>
              </>
            )}

            {tab === "marketing" && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard title="Faturamento por canal" subtitle="Última origem identificada até 30 dias antes da compra" action={<Globe size={16} className="text-gray-300" />}>
                    <BarList items={data.bySource.filter((s) => s.revenue > 0).map((s) => ({ label: s.channel, value: s.revenue, sub: `${s.orders} ped.` }))} />
                  </ChartCard>
                  <ChartCard title="Visitas por canal" subtitle="Sessões iniciadas no período">
                    <BarList items={[...data.bySource].filter((s) => s.visits > 0).sort((a, b) => b.visits - a.visits).map((s) => ({ label: s.channel, value: s.visits, sub: s.conversion != null ? `${fmt.pct(s.conversion)} conv.` : undefined }))} format={fmt.num} />
                  </ChartCard>
                </div>
                <ChartCard title="Origem do tráfego" subtitle="Visitas, pedidos e conversão por canal">
                  <DataTable rows={data.bySource} columns={sourceCols} rowKey={(r) => r.channel} defaultSort={{ key: "revenue", dir: "desc" }} exportName={`origem-trafego-${periodTitle}`} />
                </ChartCard>
                <ChartCard title="Campanhas (UTM)" subtitle="Links com utm_campaign, ex.: ?utm_source=instagram&utm_medium=stories&utm_campaign=black-friday">
                  <DataTable
                    rows={data.byCampaign}
                    columns={campaignCols}
                    rowKey={(r) => `${r.source}|${r.medium}|${r.campaign}`}
                    defaultSort={{ key: "revenue", dir: "desc" }}
                    searchable
                    exportName={`campanhas-${periodTitle}`}
                    empty="Nenhuma campanha com UTM no período"
                  />
                </ChartCard>
              </>
            )}

            {tab === "cancelamentos" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ChartCard title="Motivos de cancelamento" subtitle="Quantidade de pedidos por motivo" className="lg:col-span-2">
                  <BarList
                    items={data.byCancelReason.map((r) => ({ label: r.reason, value: r.count, sub: fmt.brlCompact(r.total) }))}
                    format={(v) => `${v} pedido${v === 1 ? "" : "s"}`}
                    color="#e34948"
                    empty="Nenhum cancelamento no período 🎉"
                  />
                </ChartCard>
                <div className="space-y-3">
                  <KpiCard icon={XCircle} label="Pedidos cancelados" value={fmt.num(data.summary.cancelled)} current={data.summary.cancelled} />
                  <KpiCard icon={DollarSign} label="Valor cancelado" value={fmt.brl(cancelledTotal)} current={cancelledTotal} />
                  <KpiCard
                    icon={Percent}
                    label="Taxa de cancelamento"
                    value={fmt.pct(data.summary.orders + data.summary.cancelled ? (data.summary.cancelled / (data.summary.orders + data.summary.cancelled)) * 100 : 0)}
                    current={0}
                    hint="Cancelados ÷ (pedidos do filtro + cancelados)"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
