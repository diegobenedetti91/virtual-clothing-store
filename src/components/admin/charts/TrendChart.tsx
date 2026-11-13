"use client";

import { useId, useState } from "react";
import { INK, SERIES, niceTicks } from "./theme";
import { useWidth } from "./useWidth";

export interface TrendPoint {
  /** Rótulo completo (tooltip), ex.: "seg, 03 nov" */
  label: string;
  /** Rótulo curto do eixo X, ex.: "03/11" */
  short: string;
  value: number;
  /** Mesmo ponto no período anterior (linha de comparação) */
  previous?: number;
}

interface Props {
  data: TrendPoint[];
  format: (v: number) => string;
  formatAxis?: (v: number) => string;
  height?: number;
  color?: string;
  seriesLabel?: string;
  previousLabel?: string;
}

const PAD = { top: 12, right: 12, bottom: 26, left: 68 };

/** Área + linha com crosshair e tooltip. Período anterior em cinza (mesma escala, um eixo só). */
export default function TrendChart({
  data,
  format,
  formatAxis = format,
  height = 260,
  color = SERIES[0],
  seriesLabel = "Período atual",
  previousLabel = "Período anterior",
}: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, "");

  if (data.length === 0) {
    return <div ref={ref} className="h-[200px] flex items-center justify-center text-sm text-gray-400">Sem dados no período</div>;
  }

  const hasPrev = data.some((d) => d.previous != null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.previous ?? 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;

  const line = (key: "value" | "previous") =>
    data
      .map((d, i) => (d[key] == null ? null : `${x(i).toFixed(1)},${y(d[key] as number).toFixed(1)}`))
      .filter(Boolean)
      .map((p, i) => `${i === 0 ? "M" : "L"}${p}`)
      .join(" ");
  const area = `${line("value")} L${x(data.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  // No máximo ~8 rótulos no eixo X
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 70))));

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round((px / rect.width) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  const h = hover != null ? data[hover] : null;
  const tipLeft = hover != null ? Math.min(Math.max(x(hover), 90), width - 90) : 0;

  return (
    <div ref={ref} className="relative select-none">
      {hasPrev && (
        <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded" style={{ background: color }} /> {seriesLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded" style={{ background: INK.previous }} /> {previousLabel}
          </span>
        </div>
      )}
      <svg width={width} height={height} role="img" aria-label={seriesLabel}>
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK.baseline : INK.grid} strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={INK.muted} className="tabular-nums">
              {formatAxis(t)}
            </text>
          </g>
        ))}

        {data.map((d, i) =>
          i % every === 0 || (i === data.length - 1 && (data.length - 1) % every >= every * 0.6) ? (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={11} fill={INK.muted}>
              {d.short}
            </text>
          ) : null
        )}

        <path d={area} fill={`url(#${gradId})`} />
        {hasPrev && <path d={line("previous")} fill="none" stroke={INK.previous} strokeWidth={2} strokeLinejoin="round" />}
        <path d={line("value")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {hover != null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} stroke={INK.baseline} strokeWidth={1} />
            {h?.previous != null && <circle cx={x(hover)} cy={y(h.previous)} r={4} fill={INK.previous} stroke="#fff" strokeWidth={2} />}
            <circle cx={x(hover)} cy={y(data[hover].value)} r={5} fill={color} stroke="#fff" strokeWidth={2} />
          </g>
        )}

        <rect
          x={PAD.left}
          y={PAD.top}
          width={innerW}
          height={innerH}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>

      {h && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-black/10"
          style={{ left: tipLeft, top: 0 }}
        >
          <p className="font-semibold text-gray-900 mb-1 whitespace-nowrap">{h.label}</p>
          <p className="flex items-center gap-2 whitespace-nowrap text-gray-600">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="font-semibold text-gray-900 tabular-nums">{format(h.value)}</span>
          </p>
          {h.previous != null && (
            <p className="flex items-center gap-2 whitespace-nowrap text-gray-500">
              <span className="w-2 h-2 rounded-full" style={{ background: INK.previous }} />
              <span className="tabular-nums">{format(h.previous)}</span> antes
            </p>
          )}
        </div>
      )}
    </div>
  );
}
