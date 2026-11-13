"use client";

import Link from "next/link";
import { Flag, Settings } from "lucide-react";
import { INK, SERIES, fmt } from "./theme";

export interface GoalView {
  target: number | null;
  revenue: number;
  projected: number;
  dayOfMonth: number;
  daysInMonth: number;
  remaining: number | null;
  perDayNeeded: number | null;
}

/** Meta de faturamento do mês: atingido, projeção pelo ritmo atual e quanto vender por dia. */
export function GoalCard({ goal }: { goal: GoalView }) {
  const monthName = new Date().toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });

  if (goal.target == null || goal.target <= 0) {
    return (
      <section className="bg-white rounded-2xl border border-dashed border-gray-300 p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0"><Flag size={18} /></span>
        <div className="flex-1">
          <p className="text-[15px] font-semibold text-gray-900">Defina uma meta para {monthName}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Até agora: <b className="text-gray-700 tabular-nums">{fmt.brl(goal.revenue)}</b> · no ritmo atual, o mês fecha em <b className="text-gray-700 tabular-nums">{fmt.brl(goal.projected)}</b>.
          </p>
        </div>
        <Link href="/admin/configuracoes" className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-800 shrink-0">
          <Settings size={14} /> Definir meta
        </Link>
      </section>
    );
  }

  const pct = (goal.revenue / goal.target) * 100;
  const projPct = (goal.projected / goal.target) * 100;
  const onTrack = goal.projected >= goal.target;
  const timePct = (goal.dayOfMonth / goal.daysInMonth) * 100;

  return (
    <section className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2"><Flag size={16} className="text-gray-400" /> Meta de {monthName}</h3>
          <p className="text-xs text-gray-500 mt-0.5">Dia {goal.dayOfMonth} de {goal.daysInMonth} · pedidos pagos</p>
        </div>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${pct >= 100 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : onTrack ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}
        >
          {pct >= 100 ? "Meta batida!" : onTrack ? "No ritmo para bater" : "Abaixo do ritmo"}
        </span>
      </header>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold tracking-tight text-gray-900 tabular-nums">
          {fmt.brl(goal.revenue)} <span className="text-sm font-normal text-gray-400">de {fmt.brl(goal.target)}</span>
        </p>
        <p className="text-lg font-semibold text-gray-900 tabular-nums">{fmt.pct(pct, 0)}</p>
      </div>

      {/* Barra: atingido (cor), projeção (clara) e marcador do dia do mês */}
      <div className="relative mt-2 h-3 rounded-full bg-gray-100 overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full opacity-30" style={{ width: `${Math.min(100, projPct)}%`, background: SERIES[0] }} />
        <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, pct)}%`, background: SERIES[0] }} />
        <div className="absolute inset-y-0 w-0.5 bg-gray-900/60" style={{ left: `${timePct}%` }} title={`Hoje: ${fmt.pct(timePct, 0)} do mês`} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES[0] }} /> Vendido</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm opacity-30" style={{ background: SERIES[0] }} /> Projeção</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-0.5 h-2.5 bg-gray-900/60" /> Hoje</span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <dt className="text-gray-500">Falta</dt>
          <dd className="font-semibold text-gray-900 tabular-nums">{fmt.brl(goal.remaining ?? 0)}</dd>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <dt className="text-gray-500">Vender por dia</dt>
          <dd className="font-semibold text-gray-900 tabular-nums">{fmt.brl(goal.perDayNeeded ?? 0)}</dd>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <dt className="text-gray-500">Projeção do mês</dt>
          <dd className="font-semibold tabular-nums" style={{ color: onTrack ? INK.good : INK.critical }}>{fmt.brl(goal.projected)}</dd>
        </div>
      </dl>
    </section>
  );
}
