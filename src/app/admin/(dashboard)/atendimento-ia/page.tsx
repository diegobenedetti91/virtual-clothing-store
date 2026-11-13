import { ButtonLink } from "@/components/admin/ui/Button";
import { Bot, Cpu, DollarSign, Headset, MessageSquare, Settings } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AI_MODELS, estimateAiCostUsd } from "@/lib/aiModels";
import { usageDay } from "@/lib/aiAssistant";
import AiUsageChart from "@/components/admin/AiUsageChart";
import AiConversationsPanel, { type AiConversationView } from "@/components/admin/AiConversationsPanel";
import AiInsightsCard from "@/components/admin/AiInsightsCard";

export const dynamic = "force-dynamic";

// Visão do assistente virtual: status, uso do dia vs. limite, custo estimado e as
// conversas recentes (para a loja melhorar o texto de políticas/perguntas frequentes).

type StoredBlock = { type?: string; text?: string; name?: string };
type StoredMessage = { role: "user" | "assistant"; content: string | StoredBlock[] };

const TOOL_LABELS: Record<string, string> = {
  consultar_meus_pedidos: "consultou os pedidos do cliente",
  consultar_pedido: "consultou um pedido",
  calcular_frete: "calculou o frete",
  buscar_produtos: "buscou produtos",
};

function transcript(messages: unknown): AiConversationView["lines"] {
  if (!Array.isArray(messages)) return [];
  const out: AiConversationView["lines"] = [];
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
const card = "bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

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
  const limit = settings?.aiDailyMessageLimit ?? 300;
  const monthCost = usage.reduce((sum, d) => sum + estimateAiCostUsd(model, d), 0);
  const todayKey = usageDay();
  const today = usage.find((d) => d.day === todayKey);
  const todayMsgs = today?.messages ?? 0;
  const todayPct = limit > 0 ? Math.min(100, (todayMsgs / limit) * 100) : 0;
  const handoffs = conversations.filter((c) => c.handedOff).length;

  const views: AiConversationView[] = conversations.map((c) => {
    const lines = transcript(c.messages);
    const customer = c.customerId ? customerMap.get(c.customerId) : null;
    return {
      id: c.id,
      customer: customer ? { name: customer.name, email: customer.email } : null,
      updatedAt: c.updatedAt.toISOString(),
      userMessages: c.userMessages,
      handedOff: c.handedOff,
      preview: lines.find((l) => l.role === "user")?.text.slice(0, 140) ?? "",
      lines,
    };
  });

  // Gráfico: últimos 14 dias, do mais antigo para o mais recente
  const chart = [...usage].slice(0, 14).reverse().map((d) => ({
    label: d.day.slice(8, 10) + "/" + d.day.slice(5, 7),
    value: d.messages,
    sub: usd(estimateAiCostUsd(model, d)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Atendimento com IA</h1>
          <p className="text-sm text-gray-500 mt-1">Uso do assistente virtual da loja e as conversas com os clientes.</p>
        </div>
        {/* Página de servidor: o ícone vai como filho (não dá para passar componente como prop para o ButtonLink, que é client) */}
        <ButtonLink href="/admin/configuracoes" className="shrink-0">
          <Settings /> Configurar assistente
        </ButtonLink>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`${card} p-4`}>
          <p className="text-[13px] text-gray-500 flex items-center gap-1.5"><Bot size={14} className="text-gray-400" /> Status</p>
          <p className={`mt-1 text-lg font-semibold flex items-center gap-2 ${active ? "text-emerald-700" : "text-gray-400"}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${active ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
            {active ? "Ativo na loja" : "Desligado"}
          </p>
          {settings?.aiAssistantEnabled && !settings.aiApiKey && <p className="text-xs text-amber-700 mt-1">Ligado, mas falta a chave de API.</p>}
          {!settings?.aiAssistantEnabled && <p className="text-xs text-gray-400 mt-1">Ative em Configurações → Atendimento com IA.</p>}
        </div>
        <div className={`${card} p-4`}>
          <p className="text-[13px] text-gray-500 flex items-center gap-1.5"><MessageSquare size={14} className="text-gray-400" /> Mensagens hoje</p>
          <p className="mt-1 text-lg font-semibold text-gray-900 tabular-nums">{todayMsgs} <span className="text-sm font-normal text-gray-400">/ {limit}</span></p>
          <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className={`h-full rounded-full ${todayPct >= 90 ? "bg-red-500" : todayPct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${todayPct}%` }} />
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Ao atingir o limite, o cliente é levado ao WhatsApp.</p>
        </div>
        <div className={`${card} p-4`}>
          <p className="text-[13px] text-gray-500 flex items-center gap-1.5"><DollarSign size={14} className="text-gray-400" /> Custo estimado (30 dias)</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{usd(monthCost)}</p>
          <p className="text-[11px] text-gray-400 mt-1">Estimativa pelo modelo atual. O valor oficial está no console da Anthropic.</p>
        </div>
        <div className={`${card} p-4`}>
          <p className="text-[13px] text-gray-500 flex items-center gap-1.5"><Cpu size={14} className="text-gray-400" /> Modelo</p>
          <p className="mt-1 text-sm font-semibold text-gray-900 leading-snug">{modelLabel}</p>
          <p className="text-[11px] text-gray-500 mt-1 inline-flex items-center gap-1"><Headset size={12} /> {handoffs} de {conversations.length} conversas recentes pediram atendente</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className={`${card} p-5 xl:col-span-1`}>
          <h2 className="text-[15px] font-semibold text-gray-900">Mensagens por dia</h2>
          <p className="text-xs text-gray-500 mt-0.5 mb-3">Últimos 14 dias · passe o mouse para ver o custo</p>
          {chart.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Nenhuma mensagem ainda.</p>
          ) : (
            <AiUsageChart data={chart} />
          )}
          {usage.length > 0 && (
            <details className="mt-3 group">
              <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-900">Ver tabela detalhada (tokens)</summary>
              <div className="mt-2 max-h-64 overflow-y-auto">
                <table className="w-full text-xs tabular-nums">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="py-1.5 pr-2 font-medium">Dia</th>
                      <th className="py-1.5 px-2 font-medium text-right">Msgs</th>
                      <th className="py-1.5 px-2 font-medium text-right">Tokens (ent./saída/cache)</th>
                      <th className="py-1.5 pl-2 font-medium text-right">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((d) => (
                      <tr key={d.day} className="border-b border-gray-50">
                        <td className="py-1.5 pr-2 text-gray-700">{d.day.split("-").reverse().join("/")}</td>
                        <td className="py-1.5 px-2 text-right text-gray-700">{d.messages}</td>
                        <td className="py-1.5 px-2 text-right text-gray-500">
                          {d.inputTokens.toLocaleString("pt-BR")} / {d.outputTokens.toLocaleString("pt-BR")} / {d.cacheReadTokens.toLocaleString("pt-BR")}
                        </td>
                        <td className="py-1.5 pl-2 text-right text-gray-900">{usd(estimateAiCostUsd(model, d))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>

        <div className="xl:col-span-2">
          <AiConversationsPanel conversations={views} />
        </div>
      </div>

      <AiInsightsCard />
    </div>
  );
}
