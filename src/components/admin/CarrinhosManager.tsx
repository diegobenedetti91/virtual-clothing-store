"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown, CheckCircle2, ChevronDown, Clock, Mail, MailCheck, MessageCircle, Percent, RefreshCw, Search, Send, ShoppingCart, Wallet, X,
} from "lucide-react";
import OptimizedImg from "@/components/OptimizedImg";
import { Button } from "@/components/admin/ui/Button";
import { KpiCard } from "@/components/admin/charts/Charts";
import { fmt } from "@/components/admin/charts/theme";
import { confirmDialog, notify } from "@/lib/notify";

type Status = "open" | "reminded" | "recovered" | "closed";
interface CartItem { name: string; price: number; quantity: number; image?: string; slug?: string; size?: string; color?: string }
interface Cart {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  customerId: string | null;
  items: CartItem[];
  units: number;
  value: number;
  updatedAt: string;
  reminderSentAt: string | null;
  status: Status;
  recoveredOrder: { id: string; orderNumber: string; total: number } | null;
}
interface Summary { openValue: number; open: number; reminded: number; recovered: number; recoveredValue: number; recoveryRate: number | null; avgValue: number }

type Tab = "open" | "reminded" | "recovered" | "all";
const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: "open", label: "Para recuperar", hint: "Ainda não receberam lembrete" },
  { key: "reminded", label: "Lembrete enviado", hint: "Aguardando o cliente voltar" },
  { key: "recovered", label: "Recuperados", hint: "Compraram depois do lembrete" },
  { key: "all", label: "Todos", hint: "" },
];
const STATUS: Record<Status, { label: string; cls: string }> = {
  open: { label: "Para recuperar", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  reminded: { label: "Lembrete enviado", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  recovered: { label: "Recuperado", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  closed: { label: "Esvaziado", cls: "bg-gray-100 text-gray-500 ring-gray-200" },
};

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 60) return m <= 1 ? "agora" : `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `há ${d} dia${d === 1 ? "" : "s"}` : new Date(iso).toLocaleDateString("pt-BR");
}
const initials = (s: string) => s.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

function waLink(c: Cart) {
  const digits = (c.phone || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const phone = digits.length <= 11 ? `55${digits}` : digits;
  const first = (c.name || "").split(" ")[0];
  const pieces = c.units === 1 ? "uma peça" : `${c.units} peças`;
  const msg = `Oi${first ? `, ${first}` : ""}! Tudo bem? Vi que você deixou ${pieces} no carrinho da nossa loja 😊 Posso te ajudar a finalizar? ${typeof window !== "undefined" ? window.location.origin : ""}/carrinho`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

/** Carrinhos abandonados: indicadores, abas por situação, busca, lembrete (um ou todos) e WhatsApp. */
export default function CarrinhosManager() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("open");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "value">("recent");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const load = async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/admin/abandoned-carts");
      const d = await r.json();
      if (r.ok) { setCarts(d.carts || []); setSummary(d.summary || null); }
    } catch {
      notify.error("Não foi possível carregar os carrinhos");
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, []);

  const counts = useMemo(() => ({
    open: carts.filter((c) => c.status === "open").length,
    reminded: carts.filter((c) => c.status === "reminded").length,
    recovered: carts.filter((c) => c.status === "recovered").length,
    all: carts.length,
  }), [carts]);

  const visible = useMemo(() => {
    const nq = q.trim().toLowerCase();
    const list = carts.filter((c) => {
      if (tab !== "all" && c.status !== tab) return false;
      if (!nq) return true;
      return [c.email, c.name || "", ...c.items.map((i) => i.name)].some((t) => t.toLowerCase().includes(nq));
    });
    return [...list].sort((a, b) => (sort === "value" ? b.value - a.value : Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
  }, [carts, tab, q, sort]);

  const send = async (ids: string[], again = false) => {
    if (!ids.length) return;
    if (ids.length > 1 && !(await confirmDialog({ title: `Enviar lembrete para ${ids.length} clientes?`, message: "Cada um recebe um e-mail com as peças que deixou no carrinho e o link para finalizar.", confirmText: "Enviar e-mails" }))) return;
    if (again && !(await confirmDialog({ title: "Enviar o lembrete de novo?", message: "Este cliente já recebeu um lembrete. Insistir demais pode incomodar.", confirmText: "Reenviar" }))) return;
    setSending(ids.length > 1 ? "bulk" : ids[0]);
    try {
      const res = await fetch("/api/admin/abandoned-carts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error);
      const at = new Date().toISOString();
      setCarts((prev) => prev.map((c) => (ids.includes(c.id) && c.status !== "recovered" ? { ...c, status: "reminded", reminderSentAt: at } : c)));
      notify.success(d.sent > 1 ? `${d.sent} lembretes enviados` : "Lembrete enviado ao cliente", d.failed ? { description: `${d.failed} não puderam ser enviados.` } : undefined);
    } catch (e) {
      notify.error("Não foi possível enviar o e-mail", { description: e instanceof Error && e.message ? e.message : undefined });
    } finally {
      setSending(null);
    }
  };

  const toRemind = visible.filter((c) => c.status === "open").map((c) => c.id);

  return (
    <div className="space-y-5">
      {/* Indicadores */}
      {!summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-[104px]" />)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={Wallet} label="Em aberto" value={fmt.brl(summary.openValue)} current={summary.openValue} hint="Valor dos carrinhos ainda não recuperados" />
          <KpiCard icon={ShoppingCart} label="Para recuperar" value={fmt.num(summary.open)} current={summary.open} hint={`${summary.reminded} aguardando depois do lembrete`} />
          <KpiCard icon={CheckCircle2} label="Recuperados" value={fmt.brl(summary.recoveredValue)} current={summary.recoveredValue} hint={`${summary.recovered} venda${summary.recovered === 1 ? "" : "s"} depois do lembrete`} />
          <KpiCard icon={Percent} label="Taxa de recuperação" value={summary.recoveryRate != null ? fmt.pct(summary.recoveryRate) : "—"} current={summary.recoveryRate ?? 0} hint={`Carrinho médio: ${fmt.brl(summary.avgValue)}`} />
        </div>
      )}

      {/* Abas + ferramentas */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-gray-200 overflow-x-auto [scrollbar-width:none]">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              title={t.hint}
              onClick={() => { setTab(t.key); setOpenId(null); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition ${tab === t.key ? "bg-gray-900 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {t.label}
              <span className={`text-[11px] tabular-nums rounded-full px-1.5 ${tab === t.key ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <label className="relative flex-1 min-w-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, e-mail ou produto" className="w-full h-9 pl-8 pr-8 text-[13px] rounded-xl border border-gray-200 bg-white" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"><X size={14} /></button>}
        </label>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" icon={ArrowUpDown} onClick={() => setSort((s) => (s === "recent" ? "value" : "recent"))} title="Mudar ordenação">
            {sort === "recent" ? "Mais recentes" : "Maior valor"}
          </Button>
          <Button size="icon" icon={RefreshCw} onClick={load} loading={refreshing} aria-label="Atualizar" className="h-8 w-8" />
          {toRemind.length > 1 && (
            <Button variant="dark" size="sm" icon={Send} onClick={() => send(toRemind)} loading={sending === "bulk"} loadingText="Enviando…">
              Lembrar todos ({toRemind.length})
            </Button>
          )}
        </div>
      </div>

      {/* Lista */}
      {!loaded ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-[76px]" />)}</div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center px-4">
          <ShoppingCart size={30} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">
            {q ? "Nada encontrado para essa busca" : tab === "open" ? "Nenhum carrinho para recuperar agora" : tab === "recovered" ? "Nenhuma venda recuperada ainda" : "Nenhum carrinho aqui"}
          </p>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            {tab === "open" && !q
              ? "Quando um cliente logado deixa peças no carrinho sem finalizar, ele aparece aqui. O site também envia um lembrete automático depois de algumas horas."
              : tab === "recovered" && !q
                ? "Aparece aqui quem comprou depois de receber o lembrete."
                : ""}
          </p>
        </div>
      ) : (
        <ul className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] divide-y divide-gray-100 overflow-hidden">
          {visible.map((c) => {
            const isOpen = openId === c.id;
            const st = STATUS[c.status];
            const wa = waLink(c);
            return (
              <li key={c.id} className={isOpen ? "bg-gray-50/60" : ""}>
                <div className="grid grid-cols-[1fr_auto] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_110px_130px_200px] items-center gap-3 px-4 py-3">
                  {/* Cliente */}
                  <button type="button" onClick={() => setOpenId(isOpen ? null : c.id)} className="flex items-center gap-3 min-w-0 text-left">
                    <span className="w-9 h-9 rounded-full bg-brand-light text-brand flex items-center justify-center text-xs font-bold shrink-0">{initials(c.name || c.email)}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-gray-900 truncate">{c.name || c.email}</span>
                      <span className="block text-xs text-gray-500 truncate">{c.name ? c.email : "Cliente sem cadastro completo"}</span>
                    </span>
                  </button>

                  {/* Peças (desktop) */}
                  <button type="button" onClick={() => setOpenId(isOpen ? null : c.id)} className="hidden lg:flex items-center gap-2 min-w-0 text-left">
                    <span className="flex -space-x-2 shrink-0">
                      {c.items.slice(0, 4).map((it, i) => (
                        <span key={i} className="w-9 h-9 rounded-lg ring-2 ring-white bg-gray-100 overflow-hidden">
                          {it.image ? <OptimizedImg widths={[160]} sizes="40px" loading="lazy" src={it.image} alt="" className="w-full h-full object-cover" /> : null}
                        </span>
                      ))}
                    </span>
                    <span className="text-xs text-gray-500 truncate">
                      {c.units} {c.units === 1 ? "peça" : "peças"}
                      {c.items.length > 4 && ` · +${c.items.length - 4}`}
                    </span>
                  </button>

                  {/* Valor + tempo */}
                  <div className="hidden lg:block text-right">
                    <p className="text-sm font-semibold text-gray-900 tabular-nums">{fmt.brl(c.value)}</p>
                    <p className="text-[11px] text-gray-400 inline-flex items-center gap-1"><Clock size={10} />{ago(c.updatedAt)}</p>
                  </div>

                  {/* Situação */}
                  <div className="hidden lg:block">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${st.cls}`}>{st.label}</span>
                    {c.status === "reminded" && c.reminderSentAt && <p className="text-[10.5px] text-gray-400 mt-0.5">{ago(c.reminderSentAt)}</p>}
                    {c.recoveredOrder && (
                      <Link href={`/admin/pedidos/${c.recoveredOrder.id}`} className="block text-[10.5px] text-emerald-700 hover:underline mt-0.5">{c.recoveredOrder.orderNumber}</Link>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 justify-end">
                    <span className="lg:hidden text-sm font-semibold text-gray-900 tabular-nums mr-1">{fmt.brl(c.value)}</span>
                    {wa && c.status !== "recovered" && (
                      <a href={wa} target="_blank" rel="noopener noreferrer" title="Chamar no WhatsApp" aria-label="Chamar no WhatsApp" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#1da851] hover:bg-emerald-50">
                        <MessageCircle size={17} />
                      </a>
                    )}
                    {c.status === "open" && (
                      <Button variant="dark" size="xs" icon={Send} onClick={() => send([c.id])} loading={sending === c.id} loadingText="Enviando…">
                        <span className="hidden sm:inline">Enviar lembrete</span>
                      </Button>
                    )}
                    {c.status === "reminded" && (
                      <Button variant="ghost" size="xs" icon={MailCheck} onClick={() => send([c.id], true)} loading={sending === c.id} title="Enviar de novo">
                        <span className="hidden sm:inline">Reenviar</span>
                      </Button>
                    )}
                    <button type="button" onClick={() => setOpenId(isOpen ? null : c.id)} aria-label={isOpen ? "Recolher" : "Ver itens"} aria-expanded={isOpen} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                      <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Detalhe */}
                {isOpen && (
                  <div className="px-4 pb-4 -mt-1 animate-fade-up [animation-duration:0.2s]">
                    <div className="rounded-xl bg-white ring-1 ring-gray-200/70 p-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mb-2 lg:hidden">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${st.cls}`}>{st.label}</span>
                        <span className="inline-flex items-center gap-1"><Clock size={11} /> Abandonado {ago(c.updatedAt)}</span>
                      </div>
                      <ul className="divide-y divide-gray-100">
                        {c.items.map((it, i) => (
                          <li key={i} className="flex items-center gap-3 py-2">
                            <span className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                              {it.image ? <OptimizedImg widths={[160]} sizes="48px" loading="lazy" src={it.image} alt="" className="w-full h-full object-cover" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              {it.slug ? (
                                <Link href={`/produtos/${it.slug}`} target="_blank" className="block text-sm text-gray-900 truncate hover:underline">{it.name}</Link>
                              ) : (
                                <span className="block text-sm text-gray-900 truncate">{it.name}</span>
                              )}
                              {(it.size || it.color) && <span className="text-xs text-gray-500">{[it.size, it.color].filter(Boolean).join(" · ")}</span>}
                            </span>
                            <span className="text-xs text-gray-400 shrink-0">× {it.quantity}</span>
                            <span className="text-sm font-semibold text-gray-900 tabular-nums w-24 text-right shrink-0">{fmt.brl(it.price * it.quantity)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap items-center gap-2 pt-3 mt-1 border-t border-gray-100">
                        <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"><Mail size={13} /> {c.email}</a>
                        {c.phone && <span className="text-xs text-gray-500">· {c.phone}</span>}
                        <span className="ml-auto text-sm font-semibold text-gray-900">Total {fmt.brl(c.value)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
