"use client";

import { useMemo, useState } from "react";
import { Bot, ChevronRight, MessageCircle, Search, User, UserRound, X, Headset } from "lucide-react";

export interface AiConversationView {
  id: string;
  customer: { name: string; email: string } | null;
  updatedAt: string;
  userMessages: number;
  handedOff: boolean;
  /** Primeira pergunta do cliente (prévia na lista) */
  preview: string;
  lines: { role: "user" | "assistant" | "tool"; text: string }[];
}

type Tab = "all" | "handoff";

/** Lista de conversas do assistente com painel lateral mostrando a conversa em balões. */
export default function AiConversationsPanel({ conversations }: { conversations: AiConversationView[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<AiConversationView | null>(null);

  const handoffs = conversations.filter((c) => c.handedOff).length;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (tab === "handoff" && !c.handedOff) return false;
      if (!q) return true;
      return (c.customer?.name || "visitante").toLowerCase().includes(q) || (c.customer?.email || "").toLowerCase().includes(q) || c.lines.some((l) => l.text.toLowerCase().includes(q));
    });
  }, [conversations, tab, query]);

  const fmtWhen = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

  return (
    <section className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="px-5 pt-4 pb-0">
        <h2 className="text-[15px] font-semibold text-gray-900">Conversas recentes</h2>
        <p className="text-xs text-gray-500 mt-0.5">Leia as dúvidas mais comuns e complete as políticas e perguntas frequentes nas configurações.</p>
        <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2 border-b border-gray-100">
          <div className="flex gap-1">
            {([["all", "Todas", conversations.length], ["handoff", "Pediram atendente", handoffs]] as const).map(([k, label, n]) => (
              <button key={k} onClick={() => setTab(k)} className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium ${tab === k ? "text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>
                {label}
                <span className={`text-[11px] font-semibold rounded-full px-1.5 tabular-nums ${k === "handoff" && n > 0 ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600"}`}>{n}</span>
                <span className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gray-900 transition-transform ${tab === k ? "scale-x-100" : "scale-x-0"}`} />
              </button>
            ))}
          </div>
          <label className="relative sm:ml-auto sm:w-64 mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente ou assunto" className="w-full pl-8 pr-3 py-1.5 text-[13px] rounded-xl border border-gray-200 bg-white" />
          </label>
        </div>
      </header>

      {conversations.length === 0 ? (
        <div className="m-5 rounded-2xl border border-dashed border-gray-300 py-12 text-center">
          <MessageCircle size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-700">Nenhuma conversa ainda</p>
          <p className="text-xs text-gray-500 mt-1">Quando um cliente usar o “Precisa de ajuda?” na loja, a conversa aparece aqui.</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">Nenhuma conversa neste filtro.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {visible.map((c) => (
            <li key={c.id}>
              <button onClick={() => setOpen(c)} className="group w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-gray-50/80 transition-colors">
                <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${c.customer ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-400"}`}>
                  {c.customer ? <User size={16} /> : <UserRound size={16} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{c.customer ? c.customer.name : "Visitante"}</span>
                    {c.handedOff && <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded-full px-1.5 py-0.5"><Headset size={10} /> pediu atendente</span>}
                  </span>
                  <span className="block text-xs text-gray-500 truncate">{c.preview || "Sem mensagens"}</span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-[11px] text-gray-400">{fmtWhen(c.updatedAt)}</span>
                  <span className="block text-[11px] text-gray-500">{c.userMessages} msg</span>
                </span>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-600" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setOpen(null)} />
          <aside className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col animate-fade-up [animation-duration:0.3s]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-start gap-3 shrink-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-gray-900 truncate">{open.customer ? open.customer.name : "Visitante (sem login)"}</h3>
                <p className="text-xs text-gray-500 truncate">{open.customer?.email ? `${open.customer.email} · ` : ""}{fmtWhen(open.updatedAt)} · {open.userMessages} mensagem(ns)</p>
                {open.handedOff && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-50 rounded-lg px-2 py-1">
                    <Headset size={13} /> A IA não resolveu ou o cliente pediu atendimento humano (WhatsApp).
                  </p>
                )}
              </div>
              <button onClick={() => setOpen(null)} className="p-2 -mr-2 rounded-lg text-gray-400 hover:bg-gray-100" aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-2.5 bg-gray-50/60">
              {open.lines.length === 0 && <p className="text-xs text-gray-400 text-center">Sem mensagens respondidas.</p>}
              {open.lines.map((l, i) =>
                l.role === "tool" ? (
                  <p key={i} className="text-center text-[11px] text-gray-400 italic">🔎 {l.text}</p>
                ) : (
                  <div key={i} className={`flex items-end gap-2 ${l.role === "user" ? "justify-end" : ""}`}>
                    {l.role === "assistant" && <span className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center shrink-0"><Bot size={14} /></span>}
                    <div className={`text-sm px-3.5 py-2 rounded-2xl max-w-[80%] whitespace-pre-wrap break-words ${l.role === "user" ? "bg-gray-900 text-white rounded-br-md" : "bg-white ring-1 ring-gray-200 text-gray-800 rounded-bl-md"}`}>
                      {l.text}
                    </div>
                  </div>
                )
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
