"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Bell, Boxes, CreditCard, Info, PackageX, Repeat, RotateCcw, ShoppingCart, Tag, TrendingDown, Users, Wallet, XCircle,
} from "lucide-react";
import { BarList, ChartCard, ColumnChart, KpiCard } from "@/components/admin/charts/Charts";
import DataTable, { type Column } from "@/components/admin/charts/DataTable";
import { ProfitWaterfall, type ProfitTotalsView } from "@/components/admin/charts/ProfitWaterfall";
import { INK, SERIES, fmt } from "@/components/admin/charts/theme";

export type InsightsTab = "real" | "perdas" | "ganhos";

interface ProfitRow {
  id: string; orderNumber: string; customerName: string; createdAt: string; gross: number; coupon: number; pix: number; credit: number; fees: number;
  revenue: number; taxes: number; netRevenue: number; grossProfit: number;
  cogs: number; shipping: number; refunds: number; net: number; margin: number | null; itemsWithoutCost: number;
}
interface Group { label: string; count: number; value: number }
interface Insights {
  period: { from: string; to: string };
  profit: { totals: ProfitTotalsView & { orders: number; units: number; unitsWithoutCost: number; ordersWithFee: number; ordersWithLabelCost: number; lossOrders: number }; monthly: { label: string; gross: number; net: number; margin: number | null }[]; rows: ProfitRow[] };
  losses: {
    abandoned: { count: number; value: number; recovered: number; recoveredValue: number };
    unpaid: { pendingCount: number; pendingValue: number; cancelledCount: number; cancelledValue: number };
    cancellations: Group[];
    returnsByReason: Group[];
    returnRate: { unitsSold: number; unitsReturned: number; rate: number | null; byProduct: { productId: string; name: string; sold: number; returned: number; rate: number | null }[] };
    waitlist: { people: number; value: number; items: { productId: string; name: string; variant: string; people: number; value: number; stock: number }[] };
    deadStock: { count: number; units: number; capital: number; items: { productId: string; name: string; stock: number; unitCost: number; costKnown: boolean; capital: number }[] };
  };
  growth: {
    abc: { productId: string; name: string; qty: number; revenue: number; profit: number; costKnown: boolean; share: number; cumShare: number; class: "A" | "B" | "C" }[];
    sizes: { label: string; qty: number }[];
    colors: { label: string; qty: number }[];
    customers: { buyers: number; recurring: number; recurrenceRate: number | null; avgDaysBetween: number | null; avgValue: number; avgOrders: number };
    coupons: { code: string; uses: number; discount: number; revenue: number; roi: number | null }[];
  };
}

const CLASS_TONE: Record<string, string> = {
  A: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  B: "bg-blue-50 text-blue-700 ring-blue-200",
  C: "bg-gray-100 text-gray-600 ring-gray-200",
};

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs text-gray-500">
      <Info size={13} className="shrink-0 mt-0.5" /> <span>{children}</span>
    </p>
  );
}

/** Abas de análise avançada (lucro real, perdas, produtos e clientes) para o período dos filtros. */
export default function InsightsPanels({ tab, from, to }: { tab: InsightsTab; from: string; to: string }) {
  const [data, setData] = useState<Insights | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const key = `${from}|${to}`;
  const loading = loadedKey !== key;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/insights?from=${from}&to=${to}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: Insights) => { if (!cancelled) { setData(d); setFailed(false); } })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoadedKey(key));
    return () => { cancelled = true; };
  }, [from, to, key]);

  const profitCols: Column<ProfitRow>[] = useMemo(() => [
    { key: "orderNumber", header: "Pedido", value: (r) => r.orderNumber, render: (r) => <Link href={`/admin/pedidos/${r.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-gray-900 hover:text-brand">{r.orderNumber}</Link> },
    { key: "createdAt", header: "Data", value: (r) => r.createdAt, render: (r) => new Date(r.createdAt).toLocaleDateString("pt-BR"), className: "text-gray-500" },
    { key: "gross", header: "GMV", value: (r) => r.gross, render: (r) => fmt.brl(r.gross), align: "right" },
    { key: "discounts", header: "Descontos", value: (r) => r.coupon + r.pix + r.credit, render: (r) => (r.coupon + r.pix + r.credit ? `−${fmt.brl(r.coupon + r.pix + r.credit)}` : "—"), align: "right", className: "text-gray-500" },
    { key: "revenue", header: "Faturamento", value: (r) => r.revenue, render: (r) => fmt.brl(r.revenue), align: "right", className: "text-gray-900" },
    { key: "deductions", header: "Devol./impostos", value: (r) => r.refunds + r.taxes, render: (r) => (r.refunds + r.taxes ? `−${fmt.brl(r.refunds + r.taxes)}` : "—"), align: "right", className: "text-gray-500" },
    { key: "cogs", header: "CMV", value: (r) => r.cogs, render: (r) => <span>{r.cogs ? `−${fmt.brl(r.cogs)}` : "—"}{r.itemsWithoutCost > 0 && <span className="ml-1 text-amber-600" title="Peças sem preço de custo">*</span>}</span>, align: "right", className: "text-gray-500" },
    { key: "costs", header: "Taxa/frete", value: (r) => r.fees + r.shipping, render: (r) => (r.fees + r.shipping ? `−${fmt.brl(r.fees + r.shipping)}` : "—"), align: "right", className: "text-gray-500" },
    { key: "net", header: "Lucro líquido", value: (r) => r.net, render: (r) => <span className={`font-semibold ${r.net < 0 ? "text-red-600" : "text-emerald-700"}`}>{r.net < 0 && "▼ "}{fmt.brl(r.net)}</span>, align: "right" },
    { key: "margin", header: "Margem", value: (r) => r.margin, render: (r) => (r.margin != null ? fmt.pct(r.margin) : "—"), align: "right", className: "text-gray-600" },
  ], []);

  if (failed && !data) return <div className="text-center py-16 text-gray-400">Não foi possível carregar a análise.</div>;
  if (!data) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-[110px]" />)}</div>;

  const t = data.profit.totals;
  const L = data.losses;
  const G = data.growth;

  return (
    <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
      {tab === "real" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Wallet} label="Lucro líquido" value={fmt.brlCompact(t.net)} current={t.net} hint="Depois de descontos, devoluções, impostos, CMV, taxas e frete" />
            <KpiCard icon={TrendingDown} label="Margem líquida" value={t.margin != null ? fmt.pct(t.margin) : "—"} current={t.margin ?? 0} hint="Lucro líquido ÷ receita líquida" />
            <KpiCard icon={CreditCard} label="Lucro por pedido" value={t.orders ? fmt.brl(t.net / t.orders) : "—"} current={t.orders ? t.net / t.orders : 0} hint={`${t.orders} pedidos pagos`} />
            <KpiCard icon={AlertTriangle} label="Pedidos com prejuízo" value={fmt.num(t.lossOrders)} current={t.lossOrders} />
          </div>
          {(t.unitsWithoutCost > 0 || t.ordersWithLabelCost < t.orders || !t.taxRate) && (
            <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3 text-[13px] text-amber-900 space-y-1">
              {!t.taxRate && <p>Os impostos sobre as vendas ainda não entram na conta. Informe a alíquota em <Link href="/admin/configuracoes" className="underline">Configurações → Loja</Link> para o lucro bater com a realidade.</p>}
              {t.unitsWithoutCost > 0 && <p><b>{t.unitsWithoutCost}</b> de {t.units} peças vendidas não têm preço de custo — para elas o custo conta como zero e o lucro aparece maior. Cadastre o custo em <Link href="/admin/produtos" className="underline">Produtos</Link>.</p>}
              {t.ordersWithLabelCost < t.orders && <p>O custo real da etiqueta é registrado só para pedidos novos ({t.ordersWithLabelCost} de {t.orders}); nos demais, desconta-se o frete cobrado do cliente como estimativa.</p>}
            </div>
          )}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <ChartCard title="DRE: das vendas ao lucro" subtitle="GMV → faturamento → receita líquida → lucro bruto → lucro líquido" className="xl:col-span-2">
              <ProfitWaterfall t={t} />
            </ChartCard>
            <ChartCard title="Lucro líquido por mês" subtitle="Somente pedidos pagos do período" className="xl:col-span-3">
              <ColumnChart data={data.profit.monthly.map((m) => ({ label: m.label, value: Math.max(0, m.net), sub: `Bruto ${fmt.brl(m.gross)} · margem ${m.margin != null ? fmt.pct(m.margin) : "—"}${m.net < 0 ? ` · prejuízo ${fmt.brl(m.net)}` : ""}` }))} />
            </ChartCard>
          </div>
          <ChartCard title="Lucro por pedido" subtitle="Ordene por lucro para ver os pedidos com prejuízo · * peças sem custo">
            <DataTable rows={data.profit.rows} columns={profitCols} rowKey={(r) => r.id} defaultSort={{ key: "net", dir: "asc" }} searchable exportName={`lucro-por-pedido-${data.period.from}-${data.period.to}`} />
          </ChartCard>
        </>
      )}

      {tab === "perdas" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard icon={ShoppingCart} label="Carrinhos abandonados" value={fmt.brlCompact(L.abandoned.value)} current={L.abandoned.value} hint={`${L.abandoned.count} carrinhos (todos os salvos)`} />
            <KpiCard icon={CreditCard} label="Não pagos" value={fmt.brlCompact(L.unpaid.pendingValue + L.unpaid.cancelledValue)} current={L.unpaid.pendingValue} hint="Pix/boleto não pagos há +24h e cancelados por pagamento" />
            <KpiCard icon={RotateCcw} label="Taxa de devolução" value={L.returnRate.rate != null ? fmt.pct(L.returnRate.rate) : "—"} current={L.returnRate.rate ?? 0} hint={`${L.returnRate.unitsReturned} de ${L.returnRate.unitsSold} peças`} />
            <KpiCard icon={Bell} label="Demanda sem estoque" value={fmt.brlCompact(L.waitlist.value)} current={L.waitlist.value} hint={`${L.waitlist.people} pedidos de aviso na lista de espera`} />
            <KpiCard icon={Boxes} label="Estoque parado" value={fmt.brlCompact(L.deadStock.capital)} current={L.deadStock.capital} hint={`${L.deadStock.units} peças sem venda há 60+ dias`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Carrinhos abandonados" subtitle="Clientes logados que deixaram produtos no carrinho">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Ainda abandonados</p><p className="font-semibold text-gray-900 tabular-nums">{L.abandoned.count} · {fmt.brl(L.abandoned.value)}</p></div>
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Recuperados depois</p><p className="font-semibold tabular-nums" style={{ color: INK.good }}>{L.abandoned.recovered} · {fmt.brl(L.abandoned.recoveredValue)}</p></div>
              </div>
              <div className="mt-3"><Note>Recuperado = o mesmo cliente fez um pedido pago depois de deixar o carrinho. Veja os carrinhos em <Link href="/admin/carrinhos" className="underline">Carrinhos abandonados</Link>.</Note></div>
            </ChartCard>
            <ChartCard title="Cancelamentos por motivo" subtitle="Valor dos pedidos cancelados no período">
              <BarList items={L.cancellations.map((c) => ({ label: c.label, value: c.value, sub: `${c.count} ped.` }))} color={SERIES[1]} empty="Nenhum cancelamento no período" />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Produtos que mais voltam" subtitle="Peças devolvidas ÷ peças vendidas no período">
              {L.returnRate.byProduct.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">Nenhuma devolução no período</p> : (
                <BarList items={L.returnRate.byProduct.map((p) => ({ label: p.name, value: p.rate ?? 0, sub: `${p.returned} de ${p.sold}` }))} format={(v) => fmt.pct(v)} color={SERIES[1]} />
              )}
              <div className="mt-3"><Note>Taxa alta costuma indicar problema de tamanho, foto ou descrição.</Note></div>
            </ChartCard>
            <ChartCard title="Motivos de devolução" subtitle="Solicitações no período · valor estornado">
              <BarList items={L.returnsByReason.map((r) => ({ label: r.label, value: r.count, sub: r.value ? fmt.brl(r.value) : undefined }))} format={(v) => `${v} pedido${v === 1 ? "" : "s"}`} color={SERIES[1]} empty="Nenhuma devolução no período" />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Demanda sem estoque" subtitle="Lista de espera ainda não avisada × preço" action={<Link href="/admin/lista-de-espera" className="text-xs font-medium text-gray-500 hover:text-gray-900">Ver lista</Link>}>
              <BarList items={L.waitlist.items.map((w) => ({ label: `${w.name}${w.variant !== "—" ? ` · ${w.variant}` : ""}`, value: w.value, sub: `${w.people} pessoa${w.people === 1 ? "" : "s"}` }))} empty="Ninguém na lista de espera" />
              <div className="mt-3"><Note>É venda que só acontece se o produto voltar ao estoque — boa referência para a próxima compra.</Note></div>
            </ChartCard>
            <ChartCard title="Estoque parado" subtitle="Produtos ativos com estoque e sem venda há 60+ dias">
              <BarList items={L.deadStock.items.map((p) => ({ label: p.name, value: p.capital, sub: `${p.stock} un.${p.costKnown ? "" : " · preço de venda"}` }))} color={INK.previous} empty="Nenhum produto parado" />
              <div className="mt-3"><Note>Capital empatado = estoque × custo (ou preço de venda, se não houver custo). Considere uma promoção relâmpago para girar.</Note></div>
            </ChartCard>
          </div>
        </>
      )}

      {tab === "ganhos" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Users} label="Clientes que compraram" value={fmt.num(G.customers.buyers)} current={G.customers.buyers} hint="Todo o histórico" />
            <KpiCard icon={Repeat} label="Recorrência" value={G.customers.recurrenceRate != null ? fmt.pct(G.customers.recurrenceRate) : "—"} current={G.customers.recurrenceRate ?? 0} hint={`${G.customers.recurring} clientes com 2+ pedidos`} />
            <KpiCard icon={Wallet} label="Valor por cliente" value={fmt.brl(G.customers.avgValue)} current={G.customers.avgValue} hint={`${G.customers.avgOrders.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} pedidos por cliente, em média`} />
            <KpiCard icon={Repeat} label="Volta a comprar em" value={G.customers.avgDaysBetween != null ? `${G.customers.avgDaysBetween} dias` : "—"} current={G.customers.avgDaysBetween ?? 0} hint="Intervalo médio entre compras dos recorrentes" />
          </div>

          <ChartCard title="Curva ABC por lucro" subtitle="A = produtos que somam 80% do lucro · B = próximos 15% · C = o resto">
            <DataTable
              rows={G.abc}
              rowKey={(r) => r.productId}
              defaultSort={{ key: "profit", dir: "desc" }}
              searchable
              exportName={`curva-abc-${data.period.from}-${data.period.to}`}
              columns={[
                { key: "class", header: "Classe", value: (r) => r.class, render: (r) => <span className={`inline-flex w-6 justify-center rounded-md text-xs font-bold ring-1 ${CLASS_TONE[r.class]}`}>{r.class}</span> },
                { key: "name", header: "Produto", value: (r) => r.name, className: "font-medium text-gray-900 max-w-[260px] truncate" },
                { key: "qty", header: "Peças", value: (r) => r.qty, align: "right" },
                { key: "revenue", header: "Receita", value: (r) => r.revenue, render: (r) => fmt.brl(r.revenue), align: "right" },
                { key: "profit", header: "Lucro", value: (r) => r.profit, render: (r) => <span>{fmt.brl(r.profit)}{!r.costKnown && <span className="ml-1 text-amber-600" title="Sem preço de custo: conta a receita">*</span>}</span>, align: "right", className: "text-gray-900 font-semibold" },
                { key: "share", header: "% do lucro", value: (r) => r.share, render: (r) => fmt.pct(r.share), align: "right", className: "text-gray-500" },
              ] as Column<Insights["growth"]["abc"][number]>[]}
            />
            <div className="mt-3"><Note>Concentre estoque e anúncios nos produtos A; os C são candidatos a promoção ou a sair de linha. * sem custo cadastrado.</Note></div>
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Vendas por tamanho" subtitle="Peças vendidas no período · ajuda a acertar a grade da próxima compra">
              <BarList items={G.sizes.map((s) => ({ label: s.label, value: s.qty, sub: fmt.pct((s.qty / Math.max(1, G.sizes.reduce((a, b) => a + b.qty, 0))) * 100, 0) }))} format={(v) => `${fmt.num(v)} un.`} max={12} empty="Sem tamanhos registrados nas vendas" />
            </ChartCard>
            <ChartCard title="Vendas por cor" subtitle="Peças vendidas no período">
              <BarList items={G.colors.map((s) => ({ label: s.label, value: s.qty, sub: fmt.pct((s.qty / Math.max(1, G.colors.reduce((a, b) => a + b.qty, 0))) * 100, 0) }))} format={(v) => `${fmt.num(v)} un.`} max={12} empty="Sem cores registradas nas vendas" />
            </ChartCard>
          </div>

          <ChartCard title="Retorno dos cupons" subtitle="Quanto cada cupom trouxe de venda para cada real de desconto" action={<Link href="/admin/cupons" className="text-xs font-medium text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"><Tag size={12} /> Cupons</Link>}>
            <DataTable
              rows={G.coupons}
              rowKey={(r) => r.code}
              defaultSort={{ key: "revenue", dir: "desc" }}
              exportName={`cupons-${data.period.from}-${data.period.to}`}
              empty="Nenhum pedido com cupom no período"
              columns={[
                { key: "code", header: "Cupom", value: (r) => r.code, className: "font-mono font-semibold text-gray-900" },
                { key: "uses", header: "Usos", value: (r) => r.uses, align: "right" },
                { key: "discount", header: "Desconto dado", value: (r) => r.discount, render: (r) => fmt.brl(r.discount), align: "right", className: "text-gray-500" },
                { key: "revenue", header: "Vendas", value: (r) => r.revenue, render: (r) => fmt.brl(r.revenue), align: "right", className: "text-gray-900 font-semibold" },
                { key: "roi", header: "Venda por R$ 1 de desconto", value: (r) => r.roi, render: (r) => (r.roi != null ? `R$ ${r.roi.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}` : "—"), align: "right" },
              ] as Column<Insights["growth"]["coupons"][number]>[]}
            />
          </ChartCard>
        </>
      )}

      {tab === "perdas" && L.unpaid.pendingCount + L.unpaid.cancelledCount > 0 && (
        <ChartCard title="Pagamentos que não aconteceram" subtitle="Pedidos criados que não viraram venda">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500 flex items-center gap-1"><PackageX size={12} /> Aguardando há +24h</p><p className="font-semibold text-gray-900 tabular-nums">{L.unpaid.pendingCount} · {fmt.brl(L.unpaid.pendingValue)}</p></div>
            <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500 flex items-center gap-1"><XCircle size={12} /> Cancelados por pagamento</p><p className="font-semibold text-gray-900 tabular-nums">{L.unpaid.cancelledCount} · {fmt.brl(L.unpaid.cancelledValue)}</p></div>
          </div>
          <div className="mt-3"><Note>Pix gerado e não pago costuma ser desistência no último passo — vale lembrar o cliente pelo WhatsApp.</Note></div>
        </ChartCard>
      )}
    </div>
  );
}
