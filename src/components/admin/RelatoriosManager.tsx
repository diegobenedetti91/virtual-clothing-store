"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, ShoppingCart, DollarSign, MapPin, Tag, ChevronDown, XCircle, Percent, Calendar, Filter } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

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
  revenue: number; cost: number | null; profit: number | null; margin: number | null;
}

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
  summary: Summary;
}

const STATUS_OPTIONS = [
  { value: "DELIVERED", label: "Apenas entregues" },
  { value: "CONFIRMED,SHIPPED,DELIVERED", label: "Confirmados + Enviados + Entregues" },
  { value: "PENDING,CONFIRMED,SHIPPED,DELIVERED", label: "Todos (exceto cancelados)" },
];

const MONTHS = [
  { value: 0, label: "Todo o ano" },
  { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" }, { value: 3, label: "Março" },
  { value: 4, label: "Abril" }, { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
  { value: 7, label: "Julho" }, { value: 8, label: "Agosto" }, { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" }, { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
];

function BarChart({ data, valueKey, labelKey, colorClass = "bg-brand" }: {
  data: Record<string, unknown>[];
  valueKey: string;
  labelKey: string;
  colorClass?: string;
}) {
  if (data.length === 0) return <p className="text-gray-400 text-sm text-center py-8">Sem dados no período.</p>;
  const max = Math.max(...data.map((d) => d[valueKey] as number), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => {
        const val = d[valueKey] as number;
        const pct = (val / max) * 100;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-4 text-right shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-700 truncate">{d[labelKey] as string}</span>
                <span className="text-xs font-bold text-gray-900 ml-2 shrink-0">{formatCurrency(val)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const BAR_AREA_HEIGHT = 140;

function MonthlyChart({ data }: { data: MonthData[] }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="flex items-end gap-1.5">
      {data.map((d) => {
        const heightPx = d.revenue > 0 ? Math.max((d.revenue / max) * BAR_AREA_HEIGHT, 6) : 4;
        const hasData = d.revenue > 0;
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group relative">
            {hasData && (
              <div className="absolute left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10" style={{ bottom: `calc(${heightPx}px + 20px)` }}>
                {formatCurrency(d.revenue)}
              </div>
            )}
            <div
              className={`w-full rounded-t-md transition-all duration-500 ${hasData ? "bg-brand hover:opacity-90" : "bg-gray-100"}`}
              style={{ height: `${heightPx}px` }}
            />
            <span className="text-[10px] text-gray-400 font-medium">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function RelatoriosManager() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(0);
  const [filterMode, setFilterMode] = useState<"period" | "range">("period");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statuses, setStatuses] = useState("DELIVERED");
  const [stateFilter, setStateFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ statuses });
      if (filterMode === "range") {
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
      } else {
        params.set("year", String(year));
        params.set("month", String(month));
      }
      if (stateFilter) params.set("state", stateFilter);
      const res = await fetch(`/api/admin/analytics?${params}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [year, month, filterMode, dateFrom, dateTo, statuses, stateFilter]);

  useEffect(() => { load(); }, [load]);

  const selectClass = "border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand transition appearance-none pr-8 cursor-pointer";
  const inputClass = "border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand transition cursor-pointer";

  const hasActiveFilters = stateFilter || statuses !== "DELIVERED" || (filterMode === "range" && (dateFrom || dateTo));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Filtros</span>
            {hasActiveFilters && (
              <span className="bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full">ativos</span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => { setStateFilter(""); setStatuses("DELIVERED"); setFilterMode("period"); setDateFrom(""); setDateTo(""); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Period mode toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilterMode("period")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filterMode === "period" ? "border-brand bg-brand/5 text-brand" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
          >
            Ano / Mês
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("range")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filterMode === "range" ? "border-brand bg-brand/5 text-brand" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
          >
            <Calendar size={13} />
            Intervalo de datas
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {filterMode === "period" ? (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Ano</label>
                <div className="relative">
                  <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectClass}>
                    {(data?.years ?? [year]).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Mês</label>
                <div className="relative">
                  <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectClass}>
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Data início</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Data fim</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Status dos pedidos</label>
            <div className="relative">
              <select value={statuses} onChange={(e) => setStatuses(e.target.value)} className={selectClass}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {(data?.allStates ?? []).length > 1 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Estado (UF)</label>
              <div className="relative">
                <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className={selectClass}>
                  <option value="">Todos os estados</option>
                  {(data?.allStates ?? []).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {loading && (
            <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin mb-2" />
          )}
        </div>
      </div>

      {/* Summary cards */}
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Faturamento", value: formatCurrency(data.summary.revenue), icon: DollarSign, color: "bg-green-100 text-green-600" },
              { label: "Pedidos", value: data.summary.orders, icon: ShoppingCart, color: "bg-blue-100 text-blue-600" },
              { label: "Ticket médio", value: formatCurrency(data.summary.ticket), icon: TrendingUp, color: "bg-purple-100 text-purple-600" },
              { label: "Cancelamentos", value: data.summary.cancelled, icon: XCircle, color: "bg-red-100 text-red-600" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className={`inline-flex p-2.5 rounded-xl ${color} mb-3`}>
                  <Icon size={18} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Monthly chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">
              {filterMode === "range" && (dateFrom || dateTo)
                ? `Faturamento — ${dateFrom ? new Date(dateFrom + "T12:00:00").toLocaleDateString("pt-BR") : "início"} até ${dateTo ? new Date(dateTo + "T12:00:00").toLocaleDateString("pt-BR") : "hoje"}`
                : `Faturamento mensal — ${year}`}
            </h2>
            <p className="text-xs text-gray-400 mb-5">Passe o mouse sobre as barras para ver o valor exato</p>
            <MonthlyChart data={data.monthlyRevenue} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By state */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={16} className="text-brand" />
                <h2 className="text-base font-bold text-gray-900">Vendas por estado</h2>
              </div>
              <p className="text-xs text-gray-400 mb-5">Ordenado por faturamento (maior → menor)</p>
              <BarChart
                data={data.byState as unknown as Record<string, unknown>[]}
                valueKey="revenue"
                labelKey="state"
                colorClass="bg-brand"
              />
            </div>

            {/* By category */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-1">
                <Tag size={16} className="text-purple-500" />
                <h2 className="text-base font-bold text-gray-900">Vendas por categoria</h2>
              </div>
              <p className="text-xs text-gray-400 mb-5">Ordenado por faturamento (maior → menor)</p>
              <BarChart
                data={data.byCategory as unknown as Record<string, unknown>[]}
                valueKey="revenue"
                labelKey="category"
                colorClass="bg-purple-500"
              />
            </div>
          </div>

          {/* Cancellations by reason */}
          {data.byCancelReason.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-1">
                <XCircle size={16} className="text-red-500" />
                <h2 className="text-base font-bold text-gray-900">Cancelamentos por motivo</h2>
              </div>
              <p className="text-xs text-gray-400 mb-5">Ordenado por quantidade (maior → menor)</p>
              <div className="space-y-3">
                {data.byCancelReason.map((row, i) => {
                  const max = data.byCancelReason[0].count;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-4 text-right shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-700 truncate">{row.reason}</span>
                          <span className="text-xs font-bold text-gray-900 ml-2 shrink-0">{row.count} pedido{row.count !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-red-400 transition-all duration-500" style={{ width: `${(row.count / max) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* State detail table */}
          {data.byState.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4">Detalhes por estado</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="pb-2 px-2 font-semibold text-gray-500">#</th>
                      <th className="pb-2 px-2 font-semibold text-gray-500">Estado</th>
                      <th className="pb-2 px-2 font-semibold text-gray-500 text-right">Pedidos</th>
                      <th className="pb-2 px-2 font-semibold text-gray-500 text-right">Faturamento</th>
                      <th className="pb-2 px-2 font-semibold text-gray-500 text-right">Ticket médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byState.map((row, i) => (
                      <tr key={row.state} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-2 text-gray-400 font-medium">{i + 1}</td>
                        <td className="py-2.5 px-2 font-semibold text-gray-800">{row.state}</td>
                        <td className="py-2.5 px-2 text-gray-600 text-right">{row.orders}</td>
                        <td className="py-2.5 px-2 font-bold text-gray-900 text-right">{formatCurrency(row.revenue)}</td>
                        <td className="py-2.5 px-2 text-gray-600 text-right">{formatCurrency(row.revenue / row.orders)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Profit margin by product */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-1">
              <Percent size={16} className="text-emerald-500" />
              <h2 className="text-base font-bold text-gray-900">Margem de lucro por produto</h2>
            </div>
            <p className="text-xs text-gray-400 mb-5">Produtos sem valor de compra cadastrado são exibidos sem margem calculada</p>
            {data.byProduct.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Sem dados no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="pb-2 px-2 font-semibold text-gray-500">#</th>
                      <th className="pb-2 px-2 font-semibold text-gray-500">Produto</th>
                      <th className="pb-2 px-2 font-semibold text-gray-500 text-right">Qtd vendida</th>
                      <th className="pb-2 px-2 font-semibold text-gray-500 text-right">Receita</th>
                      <th className="pb-2 px-2 font-semibold text-gray-500 text-right">Custo total</th>
                      <th className="pb-2 px-2 font-semibold text-gray-500 text-right">Lucro</th>
                      <th className="pb-2 px-2 font-semibold text-gray-500 text-right">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byProduct.map((row, i) => (
                      <tr key={row.productId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-2 text-gray-400 font-medium">{i + 1}</td>
                        <td className="py-2.5 px-2 font-semibold text-gray-800 max-w-[200px] truncate">{row.name}</td>
                        <td className="py-2.5 px-2 text-gray-600 text-right">{row.quantity}</td>
                        <td className="py-2.5 px-2 text-gray-900 text-right font-medium">{formatCurrency(row.revenue)}</td>
                        <td className="py-2.5 px-2 text-gray-600 text-right">{row.cost != null ? formatCurrency(row.cost) : <span className="text-gray-300">—</span>}</td>
                        <td className={`py-2.5 px-2 text-right font-bold ${row.profit != null ? (row.profit >= 0 ? "text-emerald-600" : "text-red-500") : "text-gray-300"}`}>
                          {row.profit != null ? formatCurrency(row.profit) : "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          {row.margin != null ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${row.margin >= 20 ? "bg-emerald-100 text-emerald-700" : row.margin >= 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>
                              {row.margin.toFixed(1)}%
                            </span>
                          ) : <span className="text-gray-300 text-xs">sem custo</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Profit margin by order */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-1">
              <Percent size={16} className="text-blue-500" />
              <h2 className="text-base font-bold text-gray-900">Margem de lucro por pedido</h2>
            </div>
            <p className="text-xs text-gray-400 mb-5">Apenas pedidos em que todos os itens têm valor de compra exibem margem calculada</p>
            {data.byOrder.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Sem dados no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="pb-2 px-2 font-semibold text-gray-500">Pedido</th>
                      <th className="pb-2 px-2 font-semibold text-gray-500">Cliente</th>
                      <th className="pb-2 px-2 font-semibold text-gray-500">Data</th>
                      <th className="pb-2 px-2 font-semibold text-gray-500 text-right">Receita</th>
                      <th className="pb-2 px-2 font-semibold text-gray-500 text-right">Custo</th>
                      <th className="pb-2 px-2 font-semibold text-gray-500 text-right">Lucro</th>
                      <th className="pb-2 px-2 font-semibold text-gray-500 text-right">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byOrder.map((row) => (
                      <tr key={row.orderNumber} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-2 font-mono text-xs text-gray-700 font-semibold">{row.orderNumber}</td>
                        <td className="py-2.5 px-2 text-gray-700 max-w-[150px] truncate">{row.customerName}</td>
                        <td className="py-2.5 px-2 text-gray-500 text-xs">{new Date(row.createdAt).toLocaleDateString("pt-BR")}</td>
                        <td className="py-2.5 px-2 text-gray-900 text-right font-medium">{formatCurrency(row.revenue)}</td>
                        <td className="py-2.5 px-2 text-gray-600 text-right">{row.cost != null ? formatCurrency(row.cost) : <span className="text-gray-300">—</span>}</td>
                        <td className={`py-2.5 px-2 text-right font-bold ${row.profit != null ? (row.profit >= 0 ? "text-emerald-600" : "text-red-500") : "text-gray-300"}`}>
                          {row.profit != null ? formatCurrency(row.profit) : "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          {row.margin != null ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${row.margin >= 20 ? "bg-emerald-100 text-emerald-700" : row.margin >= 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>
                              {row.margin.toFixed(1)}%
                            </span>
                          ) : <span className="text-gray-300 text-xs">sem custo</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="text-center py-20 text-gray-400">Erro ao carregar dados.</div>
      )}
    </div>
  );
}
