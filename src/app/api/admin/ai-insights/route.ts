import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { replyLacksInfo, replySuggestsHandoff } from "@/lib/aiAssistant";

/**
 * GET /api/admin/ai-insights?days=30
 *
 * O que o atendente de IA não soube responder, para a loja completar as políticas.
 *
 * Retorno (AiInsights):
 * {
 *   periodDays: number,                 // janela analisada (padrão 30, máx. 90)
 *   totalConversations: number,
 *   handedOffConversations: number,     // conversas encaminhadas para atendente (WhatsApp)
 *   handoffRate: number,                // % (0–100) de conversas encaminhadas
 *   totalQuestions: number,             // mensagens de clientes analisadas
 *   topics: { topic: Topic; label: string; count: number }[],   // ordenado por count desc
 *   gaps: {                             // até 100, mais recentes primeiro
 *     conversationId: string,
 *     date: string,                     // ISO
 *     question: string,                 // o que o cliente perguntou (até 300 caracteres)
 *     reply: string,                    // o que o assistente respondeu (até 300 caracteres)
 *     reason: "sem_informacao" | "encaminhado",
 *     topic: Topic,
 *   }[]
 * }
 *
 * Observação: turnos que falharam (erro da API, limite diário) não ficam gravados
 * no histórico, então só entram na contagem de encaminhamentos, não em `gaps`.
 */

type Topic = "pedido" | "frete" | "troca" | "tamanho" | "pagamento" | "produto" | "outros";

const TOPIC_LABEL: Record<Topic, string> = {
  pedido: "Pedido / rastreio",
  frete: "Frete e prazo",
  troca: "Troca / devolução",
  tamanho: "Tamanho / medidas",
  pagamento: "Pagamento",
  produto: "Produto / estoque",
  outros: "Outros",
};

// Ordem importa: o primeiro tema que casar vence
const TOPIC_RULES: [Topic, RegExp][] = [
  ["troca", /troc|devolu|devolv|reembols|estorn|arrepend|cancel/i],
  ["pedido", /pedido|rastrei|rastro|c[óo]digo|entreg(ue|a)\b|cheg(ou|a)|status|PD\d{6,}/i],
  ["frete", /frete|cep|prazo|envi(o|a)|correio|transportadora|retir/i],
  ["tamanho", /tamanho|medida|veste|caimento|forma (grande|pequena)|\b(pp|p|m|g|gg|xg)\b|busto|cintura|comprimento/i],
  ["pagamento", /pag(ar|amento)|pix|cart[ãa]o|boleto|parcel|cupom|desconto|nupay|juros/i],
  ["produto", /produto|estoque|dispon[íi]vel|tem (o|a|esse|essa)|cor(es)?\b|tecido|reposi|volta(r)? a ter|pe[çc]a/i],
];

function topicOf(text: string): Topic {
  for (const [topic, re] of TOPIC_RULES) if (re.test(text)) return topic;
  return "outros";
}

type Msg = Anthropic.Beta.BetaMessageParam;

function textOf(m: Msg): string {
  if (typeof m.content === "string") return m.content.trim();
  return (m.content as { type: string; text?: string }[])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n")
    .trim();
}

const cut = (s: string, n = 300) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const days = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("days") || "30") || 30, 1), 90);
  const since = new Date(Date.now() - days * 86400000);

  const conversations = await prisma.aiConversation.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, messages: true, handedOff: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 1000,
  });

  const topicCount = new Map<Topic, number>();
  const gaps: { conversationId: string; date: string; question: string; reply: string; reason: "sem_informacao" | "encaminhado"; topic: Topic }[] = [];
  let totalQuestions = 0;

  for (const c of conversations) {
    const msgs = (Array.isArray(c.messages) ? c.messages : []) as unknown as Msg[];
    // Percorre os turnos: pergunta do cliente (texto) → última resposta em texto do assistente antes da próxima pergunta
    let question: string | null = null;
    let reply = "";
    const closeTurn = () => {
      if (!question) return;
      const topic = topicOf(question);
      topicCount.set(topic, (topicCount.get(topic) ?? 0) + 1);
      totalQuestions++;
      const reason = replyLacksInfo(reply) ? "sem_informacao" : replySuggestsHandoff(reply) ? "encaminhado" : null;
      if (reason) {
        gaps.push({ conversationId: c.id, date: c.updatedAt.toISOString(), question: cut(question), reply: cut(reply), reason, topic });
      }
    };
    for (const m of msgs) {
      if (m.role === "user") {
        const t = textOf(m);
        if (!t) continue; // resultado de ferramenta, não é pergunta
        closeTurn();
        question = t;
        reply = "";
      } else {
        const t = textOf(m);
        if (t) reply = t;
      }
    }
    closeTurn();
  }

  const handedOff = conversations.filter((c) => c.handedOff).length;
  const topics = (Object.keys(TOPIC_LABEL) as Topic[])
    .map((topic) => ({ topic, label: TOPIC_LABEL[topic], count: topicCount.get(topic) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    periodDays: days,
    totalConversations: conversations.length,
    handedOffConversations: handedOff,
    handoffRate: conversations.length ? Math.round((handedOff / conversations.length) * 1000) / 10 : 0,
    totalQuestions,
    topics,
    gaps: gaps.slice(0, 100),
  });
}
