"use client";

import { ColumnChart } from "@/components/admin/charts/Charts";

/**
 * Gráfico de mensagens por dia do atendimento de IA.
 * Fica num componente de cliente porque os formatadores são funções,
 * e funções não podem ser passadas de um Server Component para o navegador.
 */
export default function AiUsageChart({ data }: { data: { label: string; value: number; sub?: string }[] }) {
  return (
    <ColumnChart
      data={data}
      format={(v) => `${v} mensage${v === 1 ? "m" : "ns"}`}
      formatAxis={(v) => String(Math.round(v))}
      height={200}
    />
  );
}
