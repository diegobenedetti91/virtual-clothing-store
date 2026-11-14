"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { INK, SERIES, fmt } from "./theme";

export interface ProfitTotalsView {
  gross: number;
  coupon: number;
  pix: number;
  fees: number;
  cogs: number;
  shipping: number;
  refunds: number;
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
 * Cascata do lucro: receita bruta, cada desconto/custo e o lucro líquido.
 * Barras proporcionais à receita bruta; valores sempre escritos (cor nunca sozinha).
 */
export function ProfitWaterfall({ t, compact = false }: { t: ProfitTotalsView; compact?: boolean }) {
  const steps = [
    { label: "Cupons de desconto", value: t.coupon, hint: "Valor dos cupons usados" },
    { label: "Desconto Pix", value: t.pix, hint: "Desconto para pagamento no Pix" },
    { label: "Taxas do gateway", value: t.fees, hint: "Mercado Pago e outros (quando informado)" },
    { label: "Custo das peças", value: t.cogs, hint: "Preço de custo × quantidade" },
    { label: "Frete (etiquetas)", value: t.shipping, hint: "Repassado à transportadora: custo real da etiqueta ou, sem ele, o frete cobrado" },
    { label: "Estornos de devoluções", value: t.refunds, hint: "Devoluções aprovadas" },
  ].filter((s) => !compact || s.value > 0);
  const base = Math.max(t.gross, 1);
  const positive = t.net >= 0;

  return (
    <div className="space-y-2.5">
      <Row label="Receita bruta" hint="Produtos + frete cobrado" value={fmt.brl(t.gross)} pct={100} color={SERIES[0]} strong />
      {steps.map((s) => (
        <Row
          key={s.label}
          label={s.label}
          hint={s.hint}
          value={s.value > 0 ? `−${fmt.brl(s.value)}` : fmt.brl(0)}
          sub={t.gross > 0 && s.value > 0 ? fmt.pct((s.value / t.gross) * 100) : undefined}
          pct={(s.value / base) * 100}
          color={SERIES[1]}
          muted={s.value === 0}
        />
      ))}
      <div className="pt-2.5 mt-1 border-t border-gray-100">
        <Row
          label="Lucro líquido"
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
