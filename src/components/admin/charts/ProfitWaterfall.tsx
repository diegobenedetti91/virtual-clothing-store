"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { INK, SERIES, fmt } from "./theme";

export interface ProfitTotalsView {
  gross: number;
  coupon: number;
  pix: number;
  credit?: number;
  revenue?: number;
  refunds: number;
  taxes?: number;
  taxRate?: number;
  netRevenue?: number;
  cogs: number;
  grossProfit?: number;
  fees: number;
  shipping: number;
  net: number;
  margin: number | null;
  units?: number;
  unitsWithoutCost?: number;
  orders?: number;
  ordersWithFee?: number;
  ordersWithLabelCost?: number;
  lossOrders?: number;
}

/**
 * DRE em cascata, com os nomes do mercado:
 * Vendas brutas (GMV) → Faturamento → Receita líquida → Lucro bruto → Lucro líquido.
 * Barras proporcionais ao GMV; valores sempre escritos (cor nunca sozinha).
 */
export function ProfitWaterfall({ t, compact = false }: { t: ProfitTotalsView; compact?: boolean }) {
  const base = Math.max(t.gross, 1);
  const revenue = t.revenue ?? t.gross - t.coupon - t.pix - (t.credit ?? 0);
  const taxes = t.taxes ?? 0;
  const netRevenue = t.netRevenue ?? revenue - t.refunds - taxes;
  const grossProfit = t.grossProfit ?? netRevenue - t.cogs;
  const positive = t.net >= 0;
  const pctOf = (v: number) => (t.gross > 0 && v > 0 ? fmt.pct((v / t.gross) * 100) : undefined);

  type Line =
    | { kind: "minus"; label: string; value: number; hint: string }
    | { kind: "total"; label: string; value: number; hint: string; color: string };
  const lines: Line[] = [
    { kind: "minus", label: "Cupons de desconto", value: t.coupon, hint: "Valor dos cupons usados (inclui frete grátis)" },
    { kind: "minus", label: "Desconto Pix", value: t.pix, hint: "Desconto para pagamento no Pix" },
    { kind: "minus", label: "Cashback usado (crédito)", value: t.credit ?? 0, hint: "Crédito da conta usado pelos clientes como desconto" },
    { kind: "total", label: "Faturamento", value: revenue, hint: "O que os clientes pagaram (valor das notas)", color: SERIES[0] },
    { kind: "minus", label: "Devoluções (estornos)", value: t.refunds, hint: "Devoluções aprovadas" },
    {
      kind: "minus",
      label: t.taxRate ? `Impostos sobre vendas (${t.taxRate.toLocaleString("pt-BR")}%)` : "Impostos sobre vendas",
      value: taxes,
      hint: t.taxRate ? "Alíquota configurada × (faturamento − devoluções)" : "Configure a alíquota em Configurações → Loja para descontar os impostos",
    },
    { kind: "total", label: "Receita líquida", value: netRevenue, hint: "Faturamento − devoluções − impostos", color: SERIES[0] },
    { kind: "minus", label: "Custo das peças (CMV)", value: t.cogs, hint: "Custo da mercadoria vendida: preço de custo × quantidade" },
    { kind: "total", label: "Lucro bruto", value: grossProfit, hint: "Receita líquida − CMV", color: SERIES[0] },
    { kind: "minus", label: "Taxas de pagamento", value: t.fees, hint: "Mercado Pago e outros (quando informado)" },
    { kind: "minus", label: "Frete (etiquetas)", value: t.shipping, hint: "Repassado à transportadora: custo real da etiqueta ou, sem ele, o frete cobrado" },
  ];
  const visible = lines.filter((l) => l.kind === "total" || !compact || l.value > 0);

  return (
    <div className="space-y-2.5">
      <Row label="Vendas brutas (GMV)" hint="Produtos a preço cheio + frete cobrado, antes dos descontos" value={fmt.brl(t.gross)} pct={100} color={SERIES[0]} strong />
      {visible.map((l) =>
        l.kind === "total" ? (
          <Row key={l.label} label={`= ${l.label}`} hint={l.hint} value={fmt.brl(l.value)} sub={pctOf(l.value)} pct={(Math.abs(l.value) / base) * 100} color={l.color} strong />
        ) : (
          <Row
            key={l.label}
            label={l.label}
            hint={l.hint}
            value={l.value > 0 ? `−${fmt.brl(l.value)}` : fmt.brl(0)}
            sub={pctOf(l.value)}
            pct={(l.value / base) * 100}
            color={SERIES[1]}
            muted={l.value === 0}
          />
        )
      )}
      <div className="pt-2.5 mt-1 border-t border-gray-100">
        <Row
          label="= Lucro líquido"
          hint="Lucro bruto − taxas de pagamento − frete"
          value={fmt.brl(t.net)}
          sub={t.margin != null ? `margem ${fmt.pct(t.margin)}` : undefined}
          pct={(Math.abs(t.net) / base) * 100}
          color={positive ? "#0ca30c" : INK.critical}
          strong
          icon={positive ? <ArrowUpRight size={14} style={{ color: INK.good }} /> : <ArrowDownRight size={14} style={{ color: INK.critical }} />}
        />
      </div>
    </div>
  );
}

function Row({ label, hint, value, sub, pct, color, strong, muted, icon }: { label: string; hint?: string; value: string; sub?: string; pct: number; color: string; strong?: boolean; muted?: boolean; icon?: React.ReactNode }) {
  return (
    <div title={hint}>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className={`inline-flex items-center gap-1 ${strong ? "font-semibold text-gray-900" : muted ? "text-gray-400" : "text-gray-700"}`}>{icon}{label}</span>
        <span className="tabular-nums shrink-0">
          {sub && <span className="mr-2 text-xs text-gray-400">{sub}</span>}
          <span className={strong ? "font-semibold text-gray-900" : muted ? "text-gray-400" : "text-gray-900"}>{value}</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, Math.max(pct, pct > 0 ? 1 : 0))}%`, background: color }} />
      </div>
    </div>
  );
}
