// Claude models offered in Admin → Configurações → Atendimento com IA.
// Shared by the admin form (browser) and the server, so no server imports here.
export const AI_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 — mais capaz (≈ US$ 0,07 por conversa)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 — equilibrado (≈ US$ 0,035 por conversa)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 — mais econômico (≈ US$ 0,002 por conversa)" },
] as const;

export const DEFAULT_AI_MODEL = "claude-opus-5-5";

// US$ per million tokens (Anthropic list prices; cache write = 1.25x input).
// Used only for the cost estimate shown in the admin.
export const AI_MODEL_PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

export function estimateAiCostUsd(
  model: string,
  t: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens?: number }
): number {
  const p = AI_MODEL_PRICES[model] ?? AI_MODEL_PRICES[DEFAULT_AI_MODEL];
  return (
    (t.inputTokens * p.input + t.outputTokens * p.output + t.cacheReadTokens * p.cacheRead + (t.cacheWriteTokens ?? 0) * p.cacheWrite) /
    1_000_000
  );
}
