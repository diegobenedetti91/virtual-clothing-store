"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { BLUE_RAMP, HEAT_RAMP, INK, SERIES, niceTicks, fmt } from "./theme";
import { useWidth } from "./useWidth";

/* ───────────────────────── Sparkline ───────────────────────── */

export function Sparkline({ values, color = SERIES[0], width = 96, height = 28 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 3 - (v / max) * (height - 6)).toFixed(1)}`);
  const last = pts[pts.length - 1].split(",");
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <polyline points={pts.join(" ")} fill="none" stroke={INK.previous} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} />
    </svg>
  );
}

/* ───────────────────────── KPI ───────────────────────── */

export function Delta({ current, previous, invert = false, suffix = "vs. período anterior" }: { current: number; previous: number; invert?: boolean; suffix?: string }) {
  if (previous === 0 && current === 0) return <p className="text-xs text-gray-400">Sem movimento</p>;
  if (previous === 0) return <p className="text-xs text-gray-400">Sem base de comparação</p>;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const flat = Math.abs(change) < 0.5;
  const good = invert ? change < 0 : change > 0;
  const Icon = flat ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <p className="text-xs flex items-center gap-1 flex-wrap">
      <span
        className="inline-flex items-center gap-0.5 font-semibold tabular-nums"
        style={{ color: flat ? INK.secondary : good ? INK.good : INK.critical }}
      >
        <Icon size={13} />
        {change > 0 ? "+" : ""}
        {fmt.pct(change)}
      </span>
      <span className="text-gray-400">{suffix}</span>
    </p>
  );
}

export function KpiCard({
  label,
  value,
  current,
  previous,
  spark,
  invert,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  current: number;
  previous?: number;
  spark?: number[];
  invert?: boolean;
  hint?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="group relative min-w-0 bg-white rounded-2xl border border-gray-200/70 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-gray-500 flex items-center gap-1.5" title={hint}>
          {Icon && <Icon size={14} className="text-gray-400" />}
          {label}
        </p>
        {spark && <span className="hidden sm:block shrink-0"><Sparkline values={spark} /></span>}
      </div>
      <p className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 truncate">{value}</p>
      <div className="mt-1 min-h-4">{previous != null && <Delta current={current} previous={previous} invert={invert} />}</div>
    </div>
  );
}

/* ───────────────────────── Barras horizontais ranqueadas ───────────────────────── */

export interface BarItem {
  label: string;
  value: number;
  sub?: string;
  href?: string;
}

export function BarList({
  items,
  format = fmt.brl,
  color = SERIES[0],
  empty = "Sem dados no período",
  max: maxItems = 8,
}: {
  items: BarItem[];
  format?: (v: number) => string;
  color?: string;
  empty?: string;
  max?: number;
}) {
  if (items.length === 0) return <p className="text-sm text-gray-400 text-center py-8">{empty}</p>;
  const shown = items.slice(0, maxItems);
  const max = Math.max(...shown.map((d) => d.value), 1);
  return (
    <ul className="space-y-2.5">
      {shown.map((d, i) => (
        <li key={`${d.label}-${i}`} className="group" title={`${d.label}: ${format(d.value)}${d.sub ? ` · ${d.sub}` : ""}`}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-gray-700">
              <span className="text-gray-400 tabular-nums mr-1.5">{i + 1}</span>
              {d.label}
            </span>
            <span className="shrink-0 font-semibold text-gray-900 tabular-nums">
              {format(d.value)}
              {d.sub && <span className="ml-1.5 font-normal text-gray-400">{d.sub}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out group-hover:brightness-110"
              style={{ width: `${Math.max((d.value / max) * 100, 1.5)}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ───────────────────────── Parte do todo (barra segmentada) ───────────────────────── */

export interface Segment {
  label: string;
  value: number;
}

/** Até 6 fatias; o resto vira "Outros". Legenda sempre com valores (cor nunca sozinha). */
export function SegmentedBar({ segments, format = fmt.num }: { segments: Segment[]; format?: (v: number) => string }) {
  const sorted = [...segments].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5).reduce((s, x) => s + x.value, 0);
  const list = rest > 0 ? [...top, { label: "Outros", value: rest }] : top;
  const total = list.reduce((s, x) => s + x.value, 0);
  const [hover, setHover] = useState<number | null>(null);
  if (total === 0) return <p className="text-sm text-gray-400 text-center py-8">Sem dados no período</p>;
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] rounded-full overflow-hidden">
        {list.map((s, i) => (
          <div
            key={s.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="h-full transition-opacity first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(s.value / total) * 100}%`,
              background: SERIES[i % SERIES.length],
              opacity: hover == null || hover === i ? 1 : 0.35,
            }}
            title={`${s.label}: ${format(s.value)} (${fmt.pct((s.value / total) * 100)})`}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-1.5">
        {list.map((s, i) => (
          <li
            key={s.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={`flex items-center justify-between gap-3 text-[13px] rounded-lg px-1.5 py-0.5 transition-colors ${hover === i ? "bg-gray-50" : ""}`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: SERIES[i % SERIES.length] }} />
              <span className="truncate text-gray-700">{s.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-gray-900 font-semibold">
              {format(s.value)} <span className="text-gray-400 font-normal">{fmt.pct((s.value / total) * 100, 0)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────────────── Colunas (ex.: faturamento mensal) ───────────────────────── */

export function ColumnChart({
  data,
  format = fmt.brl,
  formatAxis = fmt.brlAxis,
  height = 240,
  color = SERIES[0],
}: {
  data: { label: string; value: number; sub?: string }[];
  format?: (v: number) => string;
  formatAxis?: (v: number) => string;
  height?: number;
  color?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 12, right: 8, bottom: 24, left: 68 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.min(36, slot * 0.62);
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;
  const r = 4;

  return (
    <div ref={ref} className="relative select-none">
      <svg width={width} height={height} role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK.baseline : INK.grid} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={INK.muted} className="tabular-nums">
              {formatAxis(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.left + slot * i + slot / 2;
          const h = Math.max(0, y(0) - y(d.value));
          const x0 = cx - barW / 2;
          const rr = Math.min(r, h);
          // Só o topo arredondado; a base fica reta, ancorada no eixo
          const path = h > 0
            ? `M${x0},${y(0)} V${y(d.value) + rr} Q${x0},${y(d.value)} ${x0 + rr},${y(d.value)} H${x0 + barW - rr} Q${x0 + barW},${y(d.value)} ${x0 + barW},${y(d.value) + rr} V${y(0)} Z`
            : "";
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.left + slot * i} y={pad.top} width={slot} height={innerH} fill={hover === i ? "rgba(0,0,0,0.03)" : "transparent"} />
              {path && <path d={path} fill={color} opacity={hover == null || hover === i ? 1 : 0.55} className="transition-opacity" />}
              {(slot >= 30 || i % Math.ceil(30 / slot) === 0 || hover === i) && (
                <text x={cx} y={height - 6} textAnchor="middle" fontSize={11} fill={hover === i ? INK.primary : INK.muted}>
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-black/10 whitespace-nowrap"
          style={{ left: Math.min(Math.max(pad.left + slot * hover + slot / 2, 70), width - 70), top: 0 }}
        >
          <p className="font-semibold text-gray-900">{data[hover].label}</p>
          <p className="tabular-nums text-gray-700">{format(data[hover].value)}</p>
          {data[hover].sub && <p className="text-gray-400">{data[hover].sub}</p>}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Heatmap dia da semana × hora ───────────────────────── */

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function Heatmap({ matrix, format = (v: number) => `${v} pedido${v === 1 ? "" : "s"}` }: { matrix: number[][]; format?: (v: number) => string }) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(1, ...matrix.flat());
  const color = (v: number) => (v === 0 ? HEAT_RAMP[0] : HEAT_RAMP[Math.min(HEAT_RAMP.length - 1, 1 + Math.floor((v / max) * (HEAT_RAMP.length - 2)))]);
  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="grid gap-[2px]" style={{ gridTemplateColumns: "36px repeat(24, minmax(0, 1fr))" }}>
            {matrix.map((row, d) => (
              <div key={d} className="contents">
                <span className="text-[11px] text-gray-400 self-center">{WEEKDAYS[d]}</span>
                {row.map((v, h) => (
                  <div
                    key={h}
                    onMouseEnter={() => setHover({ d, h })}
                    onMouseLeave={() => setHover(null)}
                    className={`aspect-square rounded-[4px] transition-transform ${hover?.d === d && hover?.h === h ? "scale-125 ring-2 ring-white shadow" : ""}`}
                    style={{ background: color(v) }}
                    title={`${WEEKDAYS[d]} ${String(h).padStart(2, "0")}h: ${format(v)}`}
                  />
                ))}
              </div>
            ))}
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-[10px] text-gray-400 text-center">{h % 3 === 0 ? `${h}h` : ""}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-4 text-[11px] text-gray-500">
        <span className="min-h-4">
          {hover ? (
            <>
              <b className="text-gray-900">{WEEKDAYS[hover.d]} {String(hover.h).padStart(2, "0")}h</b> · {format(matrix[hover.d][hover.h])}
            </>
          ) : (
            "Passe o mouse para ver os detalhes"
          )}
        </span>
        <span className="flex items-center gap-1">
          menos
          {HEAT_RAMP.slice(1).map((c) => (
            <span key={c} className="w-3 h-3 rounded-[3px]" style={{ background: c }} />
          ))}
          mais
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────── Funil ───────────────────────── */

export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const first = steps[0]?.value || 0;
  if (!first) return <p className="text-sm text-gray-400 text-center py-8">Sem visitas registradas no período</p>;
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const pct = (s.value / first) * 100;
        const prev = i > 0 ? steps[i - 1].value : null;
        const stepConv = prev ? (s.value / prev) * 100 : null;
        return (
          <li key={s.label}>
            <div className="flex items-baseline justify-between gap-3 text-[13px] mb-1">
              <span className="text-gray-700 truncate">{s.label}</span>
              <span className="tabular-nums shrink-0 whitespace-nowrap">
                {stepConv != null && (
                  <span className="mr-2 text-[11px] text-gray-400" title="Em relação à etapa anterior">↓ {fmt.pct(stepConv)}</span>
                )}
                <b className="text-gray-900">{fmt.num(s.value)}</b>
              </span>
            </div>
            <div className="h-7 rounded-lg bg-gray-50 overflow-hidden">
              <div
                className="h-full rounded-lg flex items-center px-2 text-[11px] font-semibold text-white transition-[width] duration-700"
                style={{ width: `${Math.max(pct, 2)}%`, background: BLUE_RAMP[Math.min(i + 1, BLUE_RAMP.length - 1)] }}
              >
                {pct >= 12 ? fmt.pct(pct) : ""}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Funil de cliques: total de ações em cada etapa (uma pessoa pode contar várias vezes).
 * Barras proporcionais à maior etapa; ao lado, a média por entrada na loja.
 */
export function ClickFunnel({ steps }: { steps: { label: string; value: number }[] }) {
  const visits = steps[0]?.value || 0;
  const max = Math.max(...steps.map((s) => s.value), 0);
  if (!max) return <p className="text-sm text-gray-400 text-center py-8">Sem cliques registrados no período</p>;
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const pct = (s.value / max) * 100;
        const perVisit = i > 0 && visits ? s.value / visits : null;
        return (
          <li key={s.label}>
            <div className="flex items-baseline justify-between gap-3 text-[13px] mb-1">
              <span className="text-gray-700 truncate">{s.label}</span>
              <span className="tabular-nums shrink-0 whitespace-nowrap">
                {perVisit != null && (
                  <span className="mr-2 text-[11px] text-gray-400" title="Média por entrada na loja">
                    {perVisit.toLocaleString("pt-BR", { maximumFractionDigits: perVisit < 10 ? 2 : 0 })} por entrada
                  </span>
                )}
                <b className="text-gray-900">{fmt.num(s.value)}</b>
              </span>
            </div>
            <div className="h-7 rounded-lg bg-gray-50 overflow-hidden">
              <div
                className="h-full rounded-lg transition-[width] duration-700"
                style={{ width: `${Math.max(pct, 2)}%`, background: SERIES[1] ?? BLUE_RAMP[2] }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ───────────────────────── Card de gráfico ───────────────────────── */

export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 ${className}`}>
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
