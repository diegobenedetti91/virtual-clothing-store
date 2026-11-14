/**
 * Tokens dos gráficos do admin (paleta de referência validada para daltonismo).
 * Ordem categórica fixa — nunca reciclar cores; mais de 6 séries viram "Outros".
 */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"] as const;

/** Rampa ordinal azul (claro → escuro) para funil / intensidade. */
export const BLUE_RAMP = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"] as const;

/** Rampa sequencial completa para heatmap (o passo mais claro pode sumir no fundo = "quase zero"). */
export const HEAT_RAMP = ["#f1f6fd", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"] as const;

export const INK = {
  primary: "#0b0b0b",
  secondary: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  baseline: "#c3c2b7",
  previous: "#b9b8b1", // período anterior (de-ênfase)
  good: "#006300",
  critical: "#d03b3b",
} as const;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const num = new Intl.NumberFormat("pt-BR");
const numCompact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export const fmt = {
  brl: (v: number) => brl.format(v),
  brlCompact: (v: number) => (Math.abs(v) >= 10000 ? brlCompact.format(v) : brl.format(v)),
  /** Eixos: sempre curto, sem centavos (R$ 6 mil, R$ 500) */
  brlAxis: (v: number) => (Math.abs(v) >= 1000 ? brlCompact.format(v) : `R$ ${Math.round(v)}`),
  num: (v: number) => num.format(v),
  numCompact: (v: number) => numCompact.format(v),
  pct: (v: number, digits = 1) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: 0 })}%`,
};

/** Ticks "redondos" para o eixo Y. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
