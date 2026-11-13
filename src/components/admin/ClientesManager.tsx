"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Users, UserPlus, ShoppingBag, Repeat, Search, X, Mail, Phone, MapPin, Heart, MessageCircle, ArrowRight, Copy, Check, Download,
  ChevronRight, XCircle, Clock,
} from "lucide-react";
import { KpiCard } from "@/components/admin/charts/Charts";
import { fmt } from "@/components/admin/charts/theme";
import { ORDER_STATUS } from "@/lib/utils";

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cpfCnpj: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  inBling: boolean;
  createdAt: string;
  /** Pedidos pagos (confirmado em diante, sem cancelados) */
  paidCount: number;
  deliveredCount: number;
  cancelledCount: number;
  pendingCount: number;
  wishlistCount: number;
  /** Soma dos pedidos pagos */
  totalSpent: number;
  lastOrderAt: string | null;
  recentOrders: { id: string; orderNumber: string; total: number; status: string; createdAt: string }[];
}

type Filter = "all" | "buyers" | "repeat" | "none" | "new";
const DAY = 86400000;

const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const AVATAR = ["bg-blue-100 text-blue-700", "bg-pink-100 text-pink-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-800", "bg-violet-100 text-violet-700"];
const avatarColor = (id: string) => AVATAR[[...id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % AVATAR.length];
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
function waLink(phone: string | null, name: string) {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.length <= 11 ? "55" : ""}${d}?text=${encodeURIComponent(`Olá, ${name.split(" ")[0]}!`)}`;
}

export default function ClientesManager({ customers }: { customers: CustomerRow[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<CustomerRow | null>(null);
  const [limit, setLimit] = useState(50);
  // "Agora" fixo no carregamento (evita chamar Date.now() a cada render)
  const [now] = useState(() => Date.now());

  const isNew = (c: CustomerRow) => now - new Date(c.createdAt).getTime() <= 30 * DAY;

  const stats = useMemo(() => ({
    total: customers.length,
    newMonth: customers.filter(isNew).length,
    buyers: customers.filter((c) => c.paidCount > 0).length,
    repeat: customers.filter((c) => c.paidCount >= 2).length,
    revenue: customers.reduce((s, c) => s + c.totalSpent, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [customers]);

  const counts: Record<Filter, number> = {
    all: customers.length,
    buyers: stats.buyers,
    repeat: stats.repeat,
    none: customers.length - stats.buyers,
    new: stats.newMonth,
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (filter === "buyers" && c.paidCount === 0) return false;
      if (filter === "repeat" && c.paidCount < 2) return false;
      if (filter === "none" && c.paidCount > 0) return false;
      if (filter === "new" && !isNew(c)) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.phone || "").replace(/\D/g, "").includes(q.replace(/\D/g, "") || "§") || (c.city || "").toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, search, filter]);

  const exportCsv = () => {
    const head = ["Nome", "E-mail", "Telefone", "Cidade", "UF", "Pedidos pagos", "Total gasto", "Último pedido", "Cadastro"];
    const esc = (v: unknown) => { const t = String(v ?? ""); return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const lines = visible.map((c) => [c.name, c.email, c.phone, c.city, c.state, c.paidCount, String(c.totalSpent.toFixed(2)).replace(".", ","), c.lastOrderAt ? fmtDate(c.lastOrderAt) : "", fmtDate(c.createdAt)].map(esc).join(";"));
    const blob = new Blob([`﻿${head.join(";")}\n${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const TABS: { key: Filter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "buyers", label: "Compraram" },
    { key: "repeat", label: "Recorrentes" },
    { key: "none", label: "Sem compras" },
    { key: "new", label: "Novos (30 dias)" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Clientes cadastrados" value={fmt.num(stats.total)} current={stats.total} />
        <KpiCard icon={UserPlus} label="Novos (30 dias)" value={fmt.num(stats.newMonth)} current={stats.newMonth} />
        <KpiCard icon={ShoppingBag} label="Já compraram" value={fmt.num(stats.buyers)} current={stats.buyers} hint={stats.total ? `${fmt.pct((stats.buyers / stats.total) * 100, 0)} dos cadastrados` : undefined} />
        <KpiCard icon={Repeat} label="Recorrentes (2+ pedidos)" value={fmt.num(stats.repeat)} current={stats.repeat} hint={stats.buyers ? `${fmt.pct((stats.repeat / stats.buyers) * 100, 0)} de quem comprou voltou` : undefined} />
      </div>

      <div className="border-b border-gray-200 flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setFilter(t.key); setLimit(50); }} className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${filter === t.key ? "text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>
            {t.label}
            <span className="text-[11px] font-semibold rounded-full px-1.5 tabular-nums bg-gray-100 text-gray-600">{counts[t.key]}</span>
            <span className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gray-900 transition-transform ${filter === t.key ? "scale-x-100" : "scale-x-0"}`} />
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, e-mail, telefone ou cidade" className="w-full pl-8 pr-3 py-2 text-[13px] rounded-xl border border-gray-200 bg-white" />
        </label>
        <button onClick={exportCsv} disabled={visible.length === 0} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 px-3 py-2 rounded-xl bg-white ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-40">
          <Download size={13} /> Exportar CSV
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <Users size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">Nenhum cliente cadastrado ainda</p>
          <p className="text-sm text-gray-500 mt-1">Os clientes aparecem aqui quando criam conta na loja.</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">Nenhum cliente encontrado com esse filtro.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="hidden lg:grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_32px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-100 bg-gray-50/60 rounded-t-2xl">
            <span>Cliente</span><span>Cidade</span><span className="text-right">Pedidos</span><span className="text-right">Total gasto</span><span>Último pedido</span><span />
          </div>
          <ul className="divide-y divide-gray-100">
            {visible.slice(0, limit).map((c) => (
              <li key={c.id}>
                <button onClick={() => setOpen(c)} className="group w-full text-left grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_32px] gap-1 lg:gap-3 items-center px-4 py-3 hover:bg-gray-50/80 transition-colors">
                  <span className="flex items-center gap-3 min-w-0">
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(c.id)}`}>{initials(c.name)}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900 truncate">{c.name}</span>
                        {isNew(c) && <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 rounded-full px-1.5">novo</span>}
                        {c.paidCount >= 2 && <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 rounded-full px-1.5">recorrente</span>}
                      </span>
                      <span className="block text-xs text-gray-400 truncate">{c.email}{c.phone ? ` · ${c.phone}` : ""}</span>
                    </span>
                  </span>
                  <span className="text-xs text-gray-600 truncate lg:pl-0 pl-12">{c.city ? `${c.city}${c.state ? `/${c.state}` : ""}` : <span className="text-gray-300">—</span>}</span>
                  <span className="text-sm lg:text-right tabular-nums text-gray-800 pl-12 lg:pl-0">
                    {c.paidCount}
                    {c.cancelledCount > 0 && <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-red-600"><XCircle size={11} />{c.cancelledCount}</span>}
                  </span>
                  <span className="text-sm lg:text-right font-semibold text-gray-900 tabular-nums pl-12 lg:pl-0">{c.totalSpent > 0 ? fmt.brl(c.totalSpent) : <span className="font-normal text-gray-300">—</span>}</span>
                  <span className="text-xs text-gray-500 pl-12 lg:pl-0">{c.lastOrderAt ? fmtDate(c.lastOrderAt) : <span className="text-gray-300">nunca comprou</span>}</span>
                  <ChevronRight size={16} className="hidden lg:block text-gray-300 group-hover:text-gray-600" />
                </button>
              </li>
            ))}
          </ul>
          {visible.length > limit && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Mostrando {limit} de {visible.length}</span>
              <button onClick={() => setLimit((l) => l + 50)} className="font-medium text-gray-700 hover:text-gray-900">Ver mais</button>
            </div>
          )}
        </div>
      )}

      {open && <CustomerPanel c={open} isNew={isNew(open)} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ───────── Ficha do cliente (painel lateral) ───────── */

function CustomerPanel({ c, isNew, onClose }: { c: CustomerRow; isNew: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  };
  const wa = waLink(c.phone, c.name);
  const address = [c.street && `${c.street}${c.number ? `, ${c.number}` : ""}`, c.neighborhood, c.city && `${c.city}${c.state ? `/${c.state}` : ""}`, c.zipCode && `CEP ${c.zipCode}`].filter(Boolean).join(" · ");
  const ticket = c.paidCount ? c.totalSpent / c.paidCount : 0;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col animate-fade-up [animation-duration:0.3s]">
        <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3 shrink-0">
          <span className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(c.id)}`}>{initials(c.name)}</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{c.name}</h2>
            <p className="text-xs text-gray-500">
              Cliente desde {fmtDate(c.createdAt)}
              {isNew && " · novo"}
              {c.inBling && " · no Bling"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg text-gray-400 hover:bg-gray-100" aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Pedidos pagos", value: String(c.paidCount) },
              { label: "Total gasto", value: c.totalSpent ? fmt.brlCompact(c.totalSpent) : "—" },
              { label: "Ticket médio", value: ticket ? fmt.brl(ticket) : "—" },
            ].map((k) => (
              <div key={k.label} className="rounded-xl bg-gray-50 px-3 py-2.5">
                <p className="text-[11px] text-gray-500">{k.label}</p>
                <p className="text-sm font-semibold text-gray-900 tabular-nums">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:brightness-95">
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}
            <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl ring-1 ring-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Mail size={15} /> E-mail
            </a>
          </div>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Contato</h3>
            <dl className="rounded-xl ring-1 ring-gray-100 divide-y divide-gray-100 text-sm">
              {[
                { key: "email", icon: Mail, label: "E-mail", value: c.email },
                { key: "phone", icon: Phone, label: "Telefone", value: c.phone },
                { key: "doc", icon: Users, label: "CPF/CNPJ", value: c.cpfCnpj },
                { key: "addr", icon: MapPin, label: "Endereço", value: address || null },
              ].map(({ key, icon: Icon, label, value }) => (
                <div key={key} className="flex items-start gap-3 px-3 py-2.5">
                  <Icon size={15} className="text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <dt className="text-[11px] text-gray-500">{label}</dt>
                    <dd className={`break-words ${value ? "text-gray-900" : "text-gray-300 italic"}`}>{value || "não informado"}</dd>
                  </div>
                  {value && (
                    <button onClick={() => copy(value, key)} className="p-1 text-gray-300 hover:text-gray-700" aria-label={`Copiar ${label}`}>
                      {copied === key ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center justify-between">
              Pedidos recentes
              <span className="normal-case tracking-normal font-normal text-gray-400">
                {c.deliveredCount} entregue{c.deliveredCount === 1 ? "" : "s"}
                {c.pendingCount > 0 && ` · ${c.pendingCount} aguardando pagamento`}
                {c.cancelledCount > 0 && ` · ${c.cancelledCount} cancelado${c.cancelledCount === 1 ? "" : "s"}`}
              </span>
            </h3>
            {c.recentOrders.length === 0 ? (
              <p className="text-sm text-gray-400 rounded-xl bg-gray-50 px-3 py-4 text-center">Ainda não fez nenhum pedido.</p>
            ) : (
              <ul className="rounded-xl ring-1 ring-gray-100 divide-y divide-gray-100">
                {c.recentOrders.map((o) => {
                  const st = ORDER_STATUS[o.status] || { label: o.status, color: "bg-gray-100 text-gray-700" };
                  return (
                    <li key={o.id}>
                      <Link href={`/admin/pedidos/${o.id}`} className="group flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-gray-900">{o.orderNumber}</span>
                          <span className="text-xs text-gray-400 inline-flex items-center gap-1"><Clock size={11} />{fmtDate(o.createdAt)}</span>
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.color}`}>{st.label}</span>
                        <span className="text-sm font-semibold text-gray-900 tabular-nums w-24 text-right">{fmt.brl(o.total)}</span>
                        <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-600" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {c.wishlistCount > 0 && (
            <p className="flex items-center gap-2 text-sm text-gray-600 rounded-xl bg-pink-50/60 px-3 py-2.5">
              <Heart size={15} className="text-pink-500" /> {c.wishlistCount} produto{c.wishlistCount === 1 ? "" : "s"} nos favoritos — bom público para avisar de promoções.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
