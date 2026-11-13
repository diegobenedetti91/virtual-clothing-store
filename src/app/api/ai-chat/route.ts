import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getCustomerFromRequest } from "@/lib/customerAuth";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import {
  AI_MODELS,
  DEFAULT_AI_MODEL,
  MAX_USER_MESSAGES_PER_CHAT,
  MAX_USER_MESSAGE_LENGTH,
  buildHandoffMessage,
  buildSystemPrompt,
  customerTexts,
  replySuggestsHandoff,
  runAiTurn,
  usageDay,
} from "@/lib/aiAssistant";

// Customer-support chat. Answers come from the Claude API; when the assistant is
// unavailable (disabled, daily limit, API error) the reply points to WhatsApp.

const HANDOFF_TEXT =
  "Não consegui responder por aqui agora. Fale com a nossa equipe pelo botão \"Falar com atendente no WhatsApp\" que eles te ajudam.";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!settings?.aiAssistantEnabled || !settings.aiApiKey) {
    return json({ error: "Atendimento automático indisponível" }, 404);
  }

  const ip = clientIp(req.headers);
  if (isRateLimited(`ai-chat:${ip}`, 20, 10 * 60 * 1000)) {
    return json({ reply: "Você enviou muitas mensagens em pouco tempo. Aguarde alguns minutos ou fale com a gente pelo WhatsApp.", handoff: true }, 429);
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.message === "string" ? body.message.trim() : "";
  if (!text) return json({ error: "Mensagem vazia" }, 400);
  if (text.length > MAX_USER_MESSAGE_LENGTH) {
    return json({ error: `Mensagem muito longa (máximo ${MAX_USER_MESSAGE_LENGTH} caracteres).` }, 400);
  }

  // Daily cap (protects the store's API bill)
  const day = usageDay();
  const today = await prisma.aiUsageDay.findUnique({ where: { day } });
  if (today && today.messages >= settings.aiDailyMessageLimit) {
    return json({ reply: HANDOFF_TEXT, handoff: true });
  }

  const customer = getCustomerFromRequest(req);

  // Existing chat or a new one (system prompt and model frozen at creation)
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
  let conversation = conversationId ? await prisma.aiConversation.findUnique({ where: { id: conversationId } }) : null;
  if (conversation && conversation.userMessages >= MAX_USER_MESSAGES_PER_CHAT) {
    return json({
      conversationId: conversation.id,
      reply: "Esta conversa ficou longa. Clique em \"Nova conversa\" para continuar, ou fale com a gente pelo WhatsApp.",
      handoff: true,
    });
  }
  if (!conversation) {
    const model = AI_MODELS.some((m) => m.id === settings.aiModel) ? settings.aiModel : DEFAULT_AI_MODEL;
    conversation = await prisma.aiConversation.create({
      data: { customerId: customer?.id ?? null, model, system: buildSystemPrompt(settings), messages: [] },
    });
  }

  const history = (Array.isArray(conversation.messages) ? conversation.messages : []) as unknown as Anthropic.Beta.BetaMessageParam[];
  // Mensagem para o WhatsApp da loja já com o contexto da conversa
  const whatsappText = buildHandoffMessage([...customerTexts(history), text]);
  const result = await runAiTurn({
    apiKey: settings.aiApiKey,
    model: conversation.model,
    system: conversation.system,
    history,
    userText: text,
    customer,
  });

  // Usage is recorded even when the turn fails (tokens were billed)
  const u = result.usage;
  await prisma.aiUsageDay
    .upsert({
      where: { day },
      create: { day, messages: 1, inputTokens: u.inputTokens, outputTokens: u.outputTokens, cacheReadTokens: u.cacheReadTokens, cacheWriteTokens: u.cacheWriteTokens },
      update: {
        messages: { increment: 1 },
        inputTokens: { increment: u.inputTokens },
        outputTokens: { increment: u.outputTokens },
        cacheReadTokens: { increment: u.cacheReadTokens },
        cacheWriteTokens: { increment: u.cacheWriteTokens },
      },
    })
    .catch((err) => console.error("[AI] Usage update failed:", err));

  if (!result.ok) {
    await prisma.aiConversation
      .update({
        where: { id: conversation.id },
        data: {
          handedOff: true,
          inputTokens: { increment: u.inputTokens },
          outputTokens: { increment: u.outputTokens },
          cacheReadTokens: { increment: u.cacheReadTokens },
        },
      })
      .catch(() => {});
    return json({ conversationId: conversation.id, reply: HANDOFF_TEXT, handoff: true, whatsappText });
  }

  // O próprio assistente encaminhou para a equipe: destaca o botão e marca a conversa
  const handoff = replySuggestsHandoff(result.reply);

  await prisma.aiConversation.update({
    where: { id: conversation.id },
    data: {
      messages: JSON.parse(JSON.stringify(result.messages)) as Prisma.InputJsonValue,
      userMessages: { increment: 1 },
      customerId: conversation.customerId ?? customer?.id ?? null,
      ...(handoff ? { handedOff: true } : {}),
      inputTokens: { increment: u.inputTokens },
      outputTokens: { increment: u.outputTokens },
      cacheReadTokens: { increment: u.cacheReadTokens },
    },
  });

  return json({ conversationId: conversation.id, reply: result.reply, whatsappText, ...(handoff ? { handoff: true } : {}) });
}
