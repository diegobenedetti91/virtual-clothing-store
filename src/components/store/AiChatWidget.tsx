"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, CreditCard, Loader2, MessageCircle, Package, RefreshCw, RotateCcw, Sparkles, Truck, UserRound, X } from "lucide-react";

// Chat de atendimento com IA. O WhatsApp só aparece quando a IA sugere uma pessoa
// ou quando o cliente pede (cartão "Continuar no WhatsApp" dentro da conversa).

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  /** A IA sugeriu (ou o cliente pediu) falar com uma pessoa nesta resposta */
  handoff?: boolean;
}

const STORAGE_KEY = "ai_chat_v1";
const SUGGESTIONS: { label: string; text: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { label: "Meu pedido", text: "Onde está meu pedido?", icon: Package },
  { label: "Prazo de entrega", text: "Qual o prazo de entrega?", icon: Truck },
  { label: "Pagamento", text: "Quais as formas de pagamento?", icon: CreditCard },
  { label: "Trocas", text: "Como faço uma troca?", icon: RefreshCw },
];

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

// Texto simples com links clicáveis e **negrito**; nada de HTML vindo da IA
function Inline({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 break-all">{part}</a>
        ) : /^\*\*[^*]+\*\*$/.test(part) ? (
          <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/** Parágrafos e listas ("- item" / "1. item") para respostas mais fáceis de ler. */
function MessageText({ text }: { text: string }) {
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const line of text.split("\n")) {
    const isItem = /^\s*([-•*]|\d+[.)])\s+/.test(line);
    const last = blocks[blocks.length - 1];
    if (!line.trim()) { blocks.push({ list: false, lines: [] }); continue; }
    if (last && last.list === isItem) last.lines.push(line);
    else blocks.push({ list: isItem, lines: [line] });
  }
  return (
    <div className="space-y-1.5">
      {blocks.filter((b) => b.lines.length).map((b, i) =>
        b.list ? (
          <ul key={i} className="space-y-1">
            {b.lines.map((l, j) => (
              <li key={j} className="flex gap-2"><span className="mt-[7px] w-1 h-1 rounded-full bg-current opacity-60 shrink-0" /><span><Inline text={l.replace(/^\s*([-•*]|\d+[.)])\s+/, "")} /></span></li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.lines.map((l, j) => <span key={j}>{j > 0 && <br />}<Inline text={l} /></span>)}</p>
        )
      )}
    </div>
  );
}

function Bubble({ role, showAvatar = true, children }: { role: "user" | "assistant"; showAvatar?: boolean; children: React.ReactNode }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-brand text-on-button px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-wrap break-words">{children}</div>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <span className={`w-7 h-7 rounded-full bg-brand-light text-brand flex items-center justify-center shrink-0 ${showAvatar ? "" : "invisible"}`}><Sparkles size={13} /></span>
      <div className="max-w-[82%] rounded-2xl rounded-bl-md bg-gray-100 text-gray-800 px-3.5 py-2 text-[14px] leading-relaxed break-words">{children}</div>
    </div>
  );
}

export default function AiChatWidget({ storeName, whatsapp }: { storeName: string; whatsapp: string | null }) {
  const [open, setOpen] = useState(false);
  const [stored] = useState(loadStored);
  const [conversationId, setConversationId] = useState<string | null>(stored.conversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(stored.messages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
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
      const handoffNow = !!data.handoff || !res.ok;
      setMessages((m) => [...m, { role: "assistant", text: reply, handoff: handoffNow }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Falha de conexão. Tente de novo ou fale com a gente pelo WhatsApp.", handoff: true }]);
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setConversationId(null);
    setMessages([]);
    setWaText(null);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir atendimento"
          className="support-float fixed right-4 sm:right-6 z-40 flex items-center justify-center gap-2 bg-brand text-on-button w-12 h-12 sm:w-auto sm:h-auto sm:pl-4 sm:pr-5 sm:py-3 rounded-full shadow-xl hover:shadow-2xl hover:opacity-95 transition-all"
        >
          <MessageCircle size={20} />
          <span className="hidden sm:inline text-sm font-semibold">Precisa de ajuda?</span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Atendimento"
          className="fixed z-50 inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[390px] sm:h-[620px] sm:max-h-[calc(100vh-3rem)] bg-white sm:rounded-3xl shadow-[0_24px_70px_-20px_rgba(0,0,0,0.35)] ring-1 ring-black/5 flex flex-col overflow-hidden animate-fade-up [animation-duration:0.25s]"
        >
          {/* Cabeçalho */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
            <span className="relative w-10 h-10 rounded-full bg-brand-light text-brand flex items-center justify-center shrink-0">
              <Sparkles size={18} />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[15px] text-gray-900 truncate">{storeName}</p>
              <p className="text-xs text-gray-500">Online · responde na hora</p>
            </div>
            {messages.length > 0 && (
              <button type="button" onClick={reset} className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100" aria-label="Nova conversa" title="Nova conversa">
                <RotateCcw size={16} />
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          {/* Conversa */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
            <Bubble role="assistant">
              Oi! 👋 Sou a assistente virtual da {storeName}. Posso te ajudar com pedidos, entrega, pagamento e trocas.
            </Bubble>

            {messages.length === 0 && (
              <div className="pl-9 pt-1">
                <p className="text-xs text-gray-400 mb-2">Escolha um assunto ou escreva abaixo</p>
                <div className="grid grid-cols-2 gap-2">
                  {SUGGESTIONS.map(({ label, text, icon: Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => send(text)}
                      className="flex items-center gap-2 rounded-xl ring-1 ring-gray-200 px-3 py-2.5 text-left text-[13px] font-medium text-gray-700 hover:ring-brand hover:text-brand hover:bg-brand-light/40 transition"
                    >
                      <Icon size={15} className="shrink-0 opacity-70" /> {label}
                    </button>
                  ))}
                </div>
                {waUrl && (
                  <button type="button" onClick={() => send("Quero falar com uma pessoa")} className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] text-gray-500 hover:text-gray-800 hover:bg-gray-50">
                    <UserRound size={14} /> Prefiro falar com uma pessoa
                  </button>
                )}
              </div>
            )}

            {messages.map((m, i) => {
              const lastHandoff = m.handoff && !messages.slice(i + 1).some((x) => x.handoff);
              return (
                <div key={i} className="space-y-2">
                  <Bubble role={m.role} showAvatar={m.role === "assistant" && messages[i - 1]?.role !== "assistant"}>
                    {m.role === "assistant" ? <MessageText text={m.text} /> : m.text}
                  </Bubble>
                  {/* WhatsApp só aparece quando a IA sugere ou o cliente pede uma pessoa */}
                  {lastHandoff && waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-9 flex items-center gap-3 rounded-2xl bg-[#25D366]/10 ring-1 ring-[#25D366]/30 px-3.5 py-3 hover:bg-[#25D366]/15 transition"
                    >
                      <span className="w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0"><MessageCircle size={17} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-gray-900">Continuar no WhatsApp</span>
                        <span className="block text-xs text-gray-600">Uma pessoa da equipe te atende · o resumo da conversa vai junto</span>
                      </span>
                      <ArrowRight size={16} className="text-gray-400 shrink-0" />
                    </a>
                  )}
                </div>
              );
            })}

            {sending && (
              <Bubble role="assistant" showAvatar={messages[messages.length - 1]?.role !== "assistant"}>
                <span className="flex items-center gap-1 py-1" aria-label="Digitando">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
                  ))}
                </span>
              </Bubble>
            )}
          </div>

          {/* Escrever */}
          <div className="px-3 pt-2 pb-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-1 rounded-full bg-gray-100 pl-4 pr-1.5 py-1.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand transition"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={1000}
                placeholder="Escreva sua mensagem…"
                className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none !border-0 !shadow-none"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="shrink-0 w-9 h-9 rounded-full bg-brand text-on-button flex items-center justify-center disabled:opacity-30 transition"
                aria-label="Enviar"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={17} />}
              </button>
            </form>
            <p className="mt-1.5 text-[10.5px] text-gray-400 text-center">Respostas automáticas com IA · podem conter erros</p>
          </div>
        </div>
      )}
    </>
  );
}
