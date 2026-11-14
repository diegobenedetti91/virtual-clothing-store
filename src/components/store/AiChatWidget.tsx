"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, RotateCcw, Bot } from "lucide-react";

// Floating support chat (AI assistant). Replaces the WhatsApp float when the
// assistant is enabled; the WhatsApp button stays inside the chat at all times.

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const STORAGE_KEY = "ai_chat_v1";
const SUGGESTIONS = ["Onde está meu pedido?", "Qual o prazo de entrega?", "Quais as formas de pagamento?", "Como faço uma troca?"];

function loadStored(): { conversationId: string | null; messages: ChatMessage[] } {
  if (typeof window === "undefined") return { conversationId: null, messages: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { conversationId: null, messages: [] };
    const data = JSON.parse(raw);
    return {
      conversationId: typeof data.conversationId === "string" ? data.conversationId : null,
      messages: Array.isArray(data.messages) ? data.messages.slice(-60) : [],
    };
  } catch {
    return { conversationId: null, messages: [] };
  }
}

// Plain text with clickable http(s) links; everything else rendered as text (no HTML)
function MessageText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function AiChatWidget({ storeName, whatsapp }: { storeName: string; whatsapp: string | null }) {
  const [open, setOpen] = useState(false);
  const [stored] = useState(loadStored);
  const [conversationId, setConversationId] = useState<string | null>(stored.conversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(stored.messages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [handoff, setHandoff] = useState(false);
  // Texto do WhatsApp com o resumo da conversa (vem do servidor a cada resposta)
  const [waText, setWaText] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const waNumber = whatsapp?.replace(/\D/g, "") || "";
  const waUrl = waNumber
    ? `https://wa.me/${waNumber.length <= 11 ? "55" : ""}${waNumber}?text=${encodeURIComponent(waText || "Olá! Vim do site e preciso de ajuda.")}`
    : null;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ conversationId, messages: messages.slice(-60) }));
    } catch {}
  }, [conversationId, messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, open]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setSending(true);
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.conversationId) setConversationId(data.conversationId);
      if (typeof data.whatsappText === "string") setWaText(data.whatsappText);
      const reply: string =
        data.reply || data.error || "Não consegui responder agora. Fale com a gente pelo WhatsApp.";
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
      if (data.handoff || !res.ok) setHandoff(true);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Falha de conexão. Tente de novo ou fale com a gente pelo WhatsApp." }]);
      setHandoff(true);
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setConversationId(null);
    setMessages([]);
    setHandoff(false);
    setWaText(null);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir atendimento"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-brand text-on-button pl-4 pr-5 py-3 rounded-full shadow-xl hover:shadow-2xl hover:opacity-95 transition-all"
        >
          <MessageCircle size={20} />
          <span className="text-sm font-semibold">Precisa de ajuda?</span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Atendimento"
          className="fixed z-50 inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[380px] sm:h-[600px] sm:max-h-[calc(100vh-3rem)] bg-white sm:rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 bg-brand text-on-button">
            <div className="flex items-center gap-2 min-w-0">
              <Bot size={20} className="shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">Atendimento {storeName}</p>
                <p className="text-[11px] opacity-90">Assistente virtual · responde na hora</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button type="button" onClick={reset} className="p-2 rounded-full hover:bg-white/15" aria-label="Nova conversa" title="Nova conversa">
                  <RotateCcw size={16} />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-white/15" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-gray-800 max-w-[85%]">
              Olá! Sou o assistente virtual da {storeName}. Posso ajudar com pedidos, rastreio, frete, pagamentos e trocas. Como posso ajudar?
            </div>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-700 hover:border-brand hover:text-brand"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm px-3 py-2 rounded-2xl max-w-[85%] whitespace-pre-wrap break-words ${
                  m.role === "user"
                    ? "ml-auto bg-brand text-on-button rounded-tr-sm"
                    : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm"
                }`}
              >
                <MessageText text={m.text} />
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 size={14} className="animate-spin" /> Digitando...
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 p-3 space-y-2 bg-white">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 w-full rounded-xl py-2 text-sm font-semibold transition-colors ${
                  handoff ? "bg-green-500 text-white hover:bg-green-600" : "bg-green-50 text-green-700 hover:bg-green-100"
                }`}
              >
                <MessageCircle size={16} /> Falar com atendente no WhatsApp
              </a>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={1000}
                placeholder="Digite sua dúvida..."
                className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="shrink-0 bg-brand text-on-button rounded-xl px-3 disabled:opacity-40"
                aria-label="Enviar"
              >
                <Send size={16} />
              </button>
            </form>
            <p className="text-[10px] text-gray-400 text-center">
              Atendimento automático com IA, pode cometer erros. As conversas são registradas para melhorar o atendimento.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
