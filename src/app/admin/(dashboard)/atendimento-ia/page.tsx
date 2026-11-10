import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AI_MODELS, estimateAiCostUsd } from "@/lib/aiModels";

// Admin view of the AI support assistant: daily usage, estimated cost and the
// latest conversations (so the store can improve its FAQ text).

type StoredBlock = { type?: string; text?: string; name?: string };
type StoredMessage = { role: "user" | "assistant"; content: string | StoredBlock[] };

const TOOL_LABELS: Record<string, string> = {
  consultar_meus_pedidos: "consultou os pedidos do cliente",
  consultar_pedido: "consultou um pedido",
  calcular_frete: "calculou o frete",
  buscar_produtos: "buscou produtos",
};

function transcript(messages: unknown): { role: "user" | "assistant" | "tool"; text: string }[] {
  if (!Array.isArray(messages)) return [];
  const out: { role: "user" | "assistant" | "tool"; text: string }[] = [];
  for (const m of messages as StoredMessage[]) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, text: m.content });
      continue;
    }
    for (const b of m.content || []) {
      if (b.type === "text" && b.text) out.push({ role: m.role, text: b.text });
      else if (b.type === "tool_use" && b.name) out.push({ role: "tool", text: TOOL_LABELS[b.name] ?? b.name });
    }
  }
  return out;
}

const usd = (n: number) => `US$ ${n.toFixed(n < 1 ? 3 : 2)}`;

export default async function AtendimentoIaPage() {
  const [settings, usage, conversations] = await Promise.all([
    prisma.companySettings.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { aiAssistantEnabled: true, aiApiKey: true, aiModel: true, aiDailyMessageLimit: true },
    }),
    prisma.aiUsageDay.findMany({ orderBy: { day: "desc" }, take: 30 }),
    prisma.aiConversation.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
  ]);

  const customerIds = [...new Set(conversations.map((c) => c.customerId).filter((id): id is string => !!id))];
  const customers = customerIds.length
    ? await prisma.customerUser.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true, email: true } })
    : [];
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  const model = settings?.aiModel ?? "claude-opus-5-5";
  const modelLabel = AI_MODELS.find((m) => m.id === model)?.label ?? model;
  const active = !!(settings?.aiAssistantEnabled && settings.aiApiKey);
  const monthCost = usage.reduce((sum, d) => sum + estimateAiCostUsd(model, d), 0);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Atendimento com IA</h1>
        <p className="text-gray-500 text-sm mt-1">
          Uso do assistente virtual e as conversas mais recentes. Configure em{" "}
          <Link href="/admin/configuracoes" className="underline">Configurações → Atendimento com IA</Link>.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Status</p>
          <p className={`text-lg font-bold ${active ? "text-green-600" : "text-gray-400"}`}>{active ? "Ativo na loja" : "Desligado"}</p>
          {settings?.aiAssistantEnabled && !settings.aiApiKey && <p className="text-xs text-amber-600 mt-1">Falta a chave de API.</p>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Modelo</p>
          <p className="text-sm font-semibold text-gray-900">{modelLabel}</p>
          <p className="text-xs text-gray-400 mt-1">Limite: {settings?.aiDailyMessageLimit ?? 300} mensagens/dia</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Custo estimado (últimos 30 dias)</p>
          <p className="text-lg font-bold text-gray-900">{usd(monthCost)}</p>
          <p className="text-xs text-gray-400 mt-1">Estimativa pelo modelo atual. O valor oficial está no console da Anthropic.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">Uso por dia</h2>
        {usage.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Nenhuma mensagem ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="pb-2 px-2 font-semibold text-gray-500">Dia</th>
                  <th className="pb-2 px-2 font-semibold text-gray-500 text-right">Mensagens</th>
                  <th className="pb-2 px-2 font-semibold text-gray-500 text-right">Tokens (entrada / saída / cache)</th>
                  <th className="pb-2 px-2 font-semibold text-gray-500 text-right">Custo estimado</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((d) => (
                  <tr key={d.day} className="border-b border-gray-50">
                    <td className="py-2 px-2 text-gray-700">{d.day.split("-").reverse().join("/")}</td>
                    <td className="py-2 px-2 text-gray-700 text-right">{d.messages}</td>
                    <td className="py-2 px-2 text-gray-500 text-right">
                      {d.inputTokens.toLocaleString("pt-BR")} / {d.outputTokens.toLocaleString("pt-BR")} / {d.cacheReadTokens.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 px-2 text-gray-900 font-medium text-right">{usd(estimateAiCostUsd(model, d))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-900 mb-1">Conversas recentes</h2>
        <p className="text-xs text-gray-400 mb-4">
          Use para ver as dúvidas mais comuns e completar as políticas e perguntas frequentes nas configurações.
        </p>
        {conversations.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Nenhuma conversa ainda.</p>
        ) : (
          <div className="space-y-2">
            {conversations.map((c) => {
              const customer = c.customerId ? customerMap.get(c.customerId) : null;
              const lines = transcript(c.messages);
              return (
                <details key={c.id} className="border border-gray-100 rounded-xl">
                  <summary className="cursor-pointer px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-semibold text-gray-800">
                      {customer ? `${customer.name} (${customer.email})` : "Visitante"}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {c.updatedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {c.userMessages} mensagem(ns)
                    </span>
                    {c.handedOff && (
                      <span className="text-[11px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">sem resposta / WhatsApp</span>
                    )}
                  </summary>
                  <div className="px-4 pb-4 space-y-2">
                    {lines.length === 0 && <p className="text-xs text-gray-400">Sem mensagens respondidas.</p>}
                    {lines.map((l, i) =>
                      l.role === "tool" ? (
                        <p key={i} className="text-[11px] text-gray-400 italic">🔎 {l.text}</p>
                      ) : (
                        <div
                          key={i}
                          className={`text-sm px-3 py-2 rounded-xl max-w-[90%] whitespace-pre-wrap ${
                            l.role === "user" ? "ml-auto bg-gray-900 text-white" : "bg-gray-50 text-gray-800"
                          }`}
                        >
                          {l.text}
                        </div>
                      )
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
