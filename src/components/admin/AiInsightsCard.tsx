"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink } from "./ui/Button";
import { HelpCircle, Lightbulb, MessageCircle, Settings } from "lucide-react";
import { BarList } from "@/components/admin/charts/Charts";
import { fmt } from "@/components/admin/charts/theme";

interface Insights {
  periodDays: number;
  totalConversations: number;
  handedOffConversations: number;
  handoffRate: number;
  totalQuestions: number;
  topics: { topic: string; label: string; count: number }[];
  gaps: { conversationId: string; date: string; question: string; reply: string; reason: "sem_informacao" | "encaminhado"; topic: string }[];
}

/** O que os clientes perguntam e o que o atendente não soube responder (para completar as políticas). */
export default function AiInsightsCard() {
  const [data, setData] = useState<Insights | null>(null);
  const [failed, setFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/ai-insights?days=30")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
  }, []);

  const card = "bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5";
  if (failed) return null;
  if (!data) return <div className="img-skeleton rounded-2xl h-56" />;

  const gaps = showAll ? data.gaps : data.gaps.slice(0, 5);
  const topicLabel = Object.fromEntries(data.topics.map((t) => [t.topic, t.label]));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <section className={card}>
        <h2 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2"><MessageCircle size={16} className="text-gray-400" /> Sobre o que perguntam</h2>
        <p className="text-xs text-gray-500 mt-0.5 mb-4">
          {fmt.num(data.totalQuestions)} perguntas em {fmt.num(data.totalConversations)} conversas · últimos {data.periodDays} dias
        </p>
        <BarList items={data.topics.map((t) => ({ label: t.label, value: t.count }))} format={(v) => `${fmt.num(v)}`} empty="Ainda sem conversas no período" />
        <p className="mt-4 text-xs text-gray-500">
          <b className="text-gray-900">{fmt.pct(data.handoffRate)}</b> das conversas precisaram de atendente ({data.handedOffConversations}).
        </p>
      </section>

      <section className={`${card} xl:col-span-2`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2"><HelpCircle size={16} className="text-gray-400" /> Perguntas que o atendente não soube responder</h2>
            <p className="text-xs text-gray-500 mt-0.5">Cada item é uma informação que falta. Escreva a resposta nas políticas e o atendente passa a responder sozinho.</p>
          </div>
          <ButtonLink href="/admin/configuracoes" size="sm" icon={Settings} className="shrink-0">
            Editar políticas
          </ButtonLink>
        </div>
        {data.gaps.length === 0 ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 text-emerald-800 text-sm px-4 py-3">
            <Lightbulb size={16} /> Nenhuma pergunta sem resposta no período. 🎉
          </div>
        ) : (
          <>
            <ul className="mt-4 divide-y divide-gray-100">
              {gaps.map((g, i) => (
                <li key={`${g.conversationId}-${i}`} className="py-3">
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-1">
                    <span className={`px-1.5 py-0.5 rounded-md font-medium ${g.reason === "encaminhado" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                      {g.reason === "encaminhado" ? "Foi para o WhatsApp" : "Sem informação"}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">{topicLabel[g.topic] || g.topic}</span>
                    {new Date(g.date).toLocaleDateString("pt-BR")}
                  </div>
                  <p className="text-sm text-gray-900">“{g.question}”</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">Resposta: {g.reply}</p>
                </li>
              ))}
            </ul>
            {data.gaps.length > 5 && (
              <Button variant="ghost" size="xs" onClick={() => setShowAll((v) => !v)} className="mt-2 -ml-2">
                {showAll ? "Mostrar menos" : `Ver todas (${data.gaps.length})`}
              </Button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
