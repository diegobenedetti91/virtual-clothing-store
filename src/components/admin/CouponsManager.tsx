"use client";

import { useEffect, useMemo, useState } from "react";
import { confirmDialog } from "@/lib/notify";
import {
  BadgePercent, Bot, Calendar, Check, Copy, DollarSign, Link2, Pencil, Plus, Search, ShoppingBag, Sparkles, Tag, Trash2, Truck, Users, X, Zap,
} from "lucide-react";
import { KpiCard } from "@/components/admin/charts/Charts";
import { Button } from "@/components/admin/ui/Button";
import { fmt } from "@/components/admin/charts/theme";

type CouponType = "PERCENT" | "FIXED" | "FREE_SHIPPING";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  maxDiscount: number | null;
  minOrderValue: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  firstPurchaseOnly: boolean;
  stackWithPix: boolean;
  showInChat: boolean;
  productIds: string | null;
  categoryIds: string | null;
  active: boolean;
  stats: { uses: number; pending: number; revenue: number; discount: number };
}
interface Option { id: string; name: string; categoryId?: string }

interface FormState {
  id?: string;
  code: string;
  description: string;
  type: CouponType;
  value: string;
  maxDiscount: string;
  minOrderValue: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perCustomer: "1" | "unlimited" | "custom";
  perCustomerCustom: string;
  firstPurchaseOnly: boolean;
  stackWithPix: boolean;
  showInChat: boolean;
  productIds: string[];
  categoryIds: string[];
  active: boolean;
}

const EMPTY: FormState = {
  code: "", description: "", type: "PERCENT", value: "", maxDiscount: "", minOrderValue: "", startsAt: "", endsAt: "",
  usageLimit: "", perCustomer: "1", perCustomerCustom: "2", firstPurchaseOnly: false, stackWithPix: false, showInChat: false, productIds: [], categoryIds: [], active: true,
};

const parseIds = (raw: string | null) => { try { const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? (v as string[]) : []; } catch { return []; } };
/** ISO → valor do <input type="datetime-local"> no fuso do navegador */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

function headline(c: Pick<Coupon, "type" | "value">) {
  if (c.type === "FREE_SHIPPING") return "Frete grátis";
  if (c.type === "FIXED") return `${fmt.brl(c.value)} OFF`;
  return `${c.value.toLocaleString("pt-BR")}% OFF`;
}

function statusOf(c: Coupon): { label: string; tone: string } {
  const now = Date.now();
  if (!c.active) return { label: "Pausado", tone: "bg-gray-100 text-gray-600 ring-gray-200" };
  if (c.endsAt && new Date(c.endsAt).getTime() < now) return { label: "Expirado", tone: "bg-gray-100 text-gray-500 ring-gray-200" };
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { label: "Agendado", tone: "bg-blue-50 text-blue-700 ring-blue-200" };
  if (c.usageLimit != null && c.stats.uses + c.stats.pending >= c.usageLimit) return { label: "Esgotado", tone: "bg-amber-50 text-amber-700 ring-amber-200" };
  return { label: "Ativo", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
}

/** Resumo das regras em português, igual o cliente vai entender. */
function describe(f: { type: CouponType; value: number; maxDiscount: number | null; minOrderValue: number | null; endsAt: string | null; startsAt: string | null; perCustomerLimit: number | null; firstPurchaseOnly: boolean; stackWithPix: boolean; usageLimit: number | null; restricted: number }) {
  const parts: string[] = [];
  if (f.type === "FREE_SHIPPING") parts.push("Frete grátis");
  else if (f.type === "FIXED") parts.push(`${fmt.brl(f.value || 0)} de desconto`);
  else parts.push(`${(f.value || 0).toLocaleString("pt-BR")}% de desconto${f.maxDiscount ? ` (até ${fmt.brl(f.maxDiscount)})` : ""}`);
  if (f.restricted) parts.push("em produtos selecionados");
  if (f.minOrderValue) parts.push(`em compras a partir de ${fmt.brl(f.minOrderValue)}`);
  if (f.firstPurchaseOnly) parts.push("só na primeira compra");
  if (f.startsAt && new Date(f.startsAt).getTime() > Date.now()) parts.push(`a partir de ${fmtDate(f.startsAt)}`);
  if (f.endsAt) parts.push(`válido até ${fmtDate(f.endsAt)}`);
  if (f.perCustomerLimit) parts.push(f.perCustomerLimit === 1 ? "1 uso por cliente" : `${f.perCustomerLimit} usos por cliente`);
  if (f.usageLimit) parts.push(`limitado a ${f.usageLimit} usos`);
  parts.push(f.stackWithPix ? "acumula com o desconto Pix" : "não acumula com o desconto Pix");
  return parts.join(", ") + ".";
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 relative w-9 h-5 rounded-full shrink-0 transition-colors ${checked ? "bg-brand" : "bg-gray-300"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </button>
      <span>
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
    </label>
  );
}

const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white";
const labelCls = "block text-xs font-medium text-gray-600 mb-1";

export default function CouponsManager() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "Ativo" | "Agendado" | "Expirado" | "Pausado">("all");
  const [productQuery, setProductQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/coupons")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setCoupons(d.coupons || []);
        setProducts(d.products || []);
        setCategories(d.categories || []);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [reload]);

  const totals = useMemo(() => ({
    active: coupons.filter((c) => statusOf(c).label === "Ativo").length,
    uses: coupons.reduce((s, c) => s + c.stats.uses, 0),
    revenue: coupons.reduce((s, c) => s + c.stats.revenue, 0),
    discount: coupons.reduce((s, c) => s + c.stats.discount, 0),
  }), [coupons]);

  const visible = filter === "all" ? coupons : coupons.filter((c) => statusOf(c).label === filter);

  const openNew = () => { setFormError(null); setProductQuery(""); setForm({ ...EMPTY }); };
  const openEdit = (c: Coupon) => {
    setFormError(null);
    setProductQuery("");
    setForm({
      id: c.id,
      code: c.code,
      description: c.description || "",
      type: c.type,
      value: c.type === "FREE_SHIPPING" ? "" : String(c.value),
      maxDiscount: c.maxDiscount ? String(c.maxDiscount) : "",
      minOrderValue: c.minOrderValue ? String(c.minOrderValue) : "",
      startsAt: toLocalInput(c.startsAt),
      endsAt: toLocalInput(c.endsAt),
      usageLimit: c.usageLimit ? String(c.usageLimit) : "",
      perCustomer: c.perCustomerLimit == null ? "unlimited" : c.perCustomerLimit === 1 ? "1" : "custom",
      perCustomerCustom: c.perCustomerLimit && c.perCustomerLimit > 1 ? String(c.perCustomerLimit) : "2",
      firstPurchaseOnly: c.firstPurchaseOnly,
      stackWithPix: c.stackWithPix,
      showInChat: !!c.showInChat,
      productIds: parseIds(c.productIds),
      categoryIds: parseIds(c.categoryIds),
      active: c.active,
    });
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFormError(null);
    const body = {
      code: form.code,
      description: form.description,
      type: form.type,
      value: form.value,
      maxDiscount: form.maxDiscount,
      minOrderValue: form.minOrderValue,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      usageLimit: form.usageLimit,
      perCustomerLimit: form.perCustomer === "unlimited" ? null : form.perCustomer === "1" ? 1 : form.perCustomerCustom,
      firstPurchaseOnly: form.firstPurchaseOnly,
      stackWithPix: form.stackWithPix,
      showInChat: form.showInChat,
      productIds: form.productIds,
      categoryIds: form.categoryIds,
      active: form.active,
    };
    try {
      const res = await fetch(form.id ? `/api/admin/coupons/${form.id}` : "/api/admin/coupons", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar");
      setForm(null);
      setReload((n) => n + 1);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: Coupon) => {
    setCoupons((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: !c.active } : x)));
    await fetch(`/api/admin/coupons/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !c.active }) });
  };

  const remove = async (c: Coupon) => {
    const ok = await confirmDialog({
      title: `Excluir o cupom ${c.code}?`,
      message: c.stats.uses > 0
        ? `Os ${c.stats.uses} pedidos que usaram continuam com o desconto registrado. Se quiser só parar de aceitar, use “Pausar”.`
        : undefined,
      confirmText: "Excluir cupom",
      tone: "danger",
    });
    if (!ok) return;
    await fetch(`/api/admin/coupons/${c.id}`, { method: "DELETE" });
    setReload((n) => n + 1);
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  };

  const randomCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const tail = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setForm((f) => (f ? { ...f, code: `${f.type === "FREE_SHIPPING" ? "FRETE" : "PROMO"}${tail}` } : f));
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const filteredProducts = productQuery.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(productQuery.trim().toLowerCase())).slice(0, 30)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Cupons de desconto</h1>
          <p className="text-sm text-gray-500 mt-1">Crie cupons por porcentagem, valor fixo ou frete grátis, com validade e regras de uso.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openNew} className="self-start sm:self-auto">
          Novo cupom
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Tag} label="Cupons ativos" value={fmt.num(totals.active)} current={totals.active} />
        <KpiCard icon={ShoppingBag} label="Pedidos com cupom" value={fmt.num(totals.uses)} current={totals.uses} hint="Pedidos pagos" />
        <KpiCard icon={DollarSign} label="Vendas com cupom" value={fmt.brlCompact(totals.revenue)} current={totals.revenue} />
        <KpiCard icon={BadgePercent} label="Desconto concedido" value={fmt.brlCompact(totals.discount)} current={totals.discount} />
      </div>

      <div className="flex gap-1 flex-wrap">
        {(["all", "Ativo", "Agendado", "Pausado", "Expirado"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${filter === f ? "bg-gray-900 text-white" : "bg-white ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            {f === "all" ? `Todos (${coupons.length})` : f}
          </button>
        ))}
      </div>

      {!loaded ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-48" />)}</div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <Sparkles size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">{coupons.length === 0 ? "Nenhum cupom ainda" : "Nenhum cupom neste filtro"}</p>
          {coupons.length === 0 && (
            <>
              <p className="text-sm text-gray-500 mt-1 mb-4">Que tal um cupom de boas-vindas? Ex.: BEMVINDO10 — 10% na primeira compra.</p>
              <Button variant="dark" size="sm" icon={Plus} onClick={openNew}>
                Criar primeiro cupom
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => {
            const st = statusOf(c);
            const restricted = parseIds(c.productIds).length + parseIds(c.categoryIds).length;
            const used = c.stats.uses + c.stats.pending;
            const link = typeof window !== "undefined" ? `${window.location.origin}/?cupom=${c.code}` : "";
            return (
              <div key={c.id} className="group bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                {/* "Ticket" */}
                <div className="relative p-4 pb-3 border-b border-dashed border-gray-200">
                  <span className="absolute -left-2.5 -bottom-2.5 w-5 h-5 rounded-full bg-[#f6f7f9] border border-gray-200/70" />
                  <span className="absolute -right-2.5 -bottom-2.5 w-5 h-5 rounded-full bg-[#f6f7f9] border border-gray-200/70" />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button onClick={() => copy(c.code, `code-${c.id}`)} className="inline-flex items-center gap-1.5 font-mono font-bold text-lg tracking-wider text-gray-900 hover:text-brand" title="Copiar código">
                        {c.code}
                        {copied === `code-${c.id}` ? <Check size={14} className="text-emerald-600" /> : <Copy size={13} className="opacity-0 group-hover:opacity-40" />}
                      </button>
                      <p className="text-2xl font-semibold tracking-tight text-brand mt-0.5 flex items-center gap-1.5">
                        {c.type === "FREE_SHIPPING" && <Truck size={20} />}
                        {headline(c)}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${st.tone}`}>{st.label}</span>
                  </div>
                  {c.description && <p className="text-xs text-gray-500 mt-1">{c.description}</p>}
                </div>

                <div className="p-4 pt-3 flex-1 flex flex-col gap-3">
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {c.minOrderValue ? <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">mín. {fmt.brl(c.minOrderValue)}</span> : null}
                    {c.maxDiscount ? <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">até {fmt.brl(c.maxDiscount)}</span> : null}
                    {c.firstPurchaseOnly && <span className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 inline-flex items-center gap-1"><Sparkles size={10} /> 1ª compra</span>}
                    {c.perCustomerLimit ? <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 inline-flex items-center gap-1"><Users size={10} /> {c.perCustomerLimit}x por cliente</span> : null}
                    {restricted > 0 && <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700">{restricted} produto(s)/categoria(s)</span>}
                    {c.stackWithPix && <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 inline-flex items-center gap-1"><Zap size={10} /> soma com Pix</span>}
                    {c.showInChat && <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 inline-flex items-center gap-1"><Bot size={10} /> divulgado pela IA</span>}
                    {(c.startsAt || c.endsAt) && (
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 inline-flex items-center gap-1">
                        <Calendar size={10} /> {c.startsAt ? fmtDate(c.startsAt) : "agora"} → {c.endsAt ? fmtDate(c.endsAt) : "sem fim"}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span><b className="text-gray-900 tabular-nums">{c.stats.uses}</b> {c.stats.uses === 1 ? "uso" : "usos"}{c.stats.pending > 0 && <span className="text-gray-400"> · {c.stats.pending} aguardando pagamento</span>}</span>
                      <span className="tabular-nums">{c.usageLimit ? `de ${c.usageLimit}` : "sem limite"}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: c.usageLimit ? `${Math.min(100, (used / c.usageLimit) * 100)}%` : c.stats.uses ? "100%" : "0%", opacity: c.usageLimit ? 1 : 0.25 }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-gray-50 px-3 py-2"><p className="text-gray-500">Vendas</p><p className="font-semibold text-gray-900 tabular-nums">{fmt.brl(c.stats.revenue)}</p></div>
                    <div className="rounded-xl bg-gray-50 px-3 py-2"><p className="text-gray-500">Desconto dado</p><p className="font-semibold text-gray-900 tabular-nums">{fmt.brl(c.stats.discount)}</p></div>
                  </div>

                  <div className="mt-auto flex items-center gap-1 pt-1">
                    <Button size="xs" icon={copied === `link-${c.id}` ? Check : Link2} onClick={() => copy(link, `link-${c.id}`)} title={link} className={copied === `link-${c.id}` ? "text-emerald-700" : undefined}>
                      {copied === `link-${c.id}` ? "Link copiado" : "Copiar link"}
                    </Button>
                    <div className="ml-auto flex items-center gap-1">
                      <Button variant="ghost" size="xs" onClick={() => toggleActive(c)}>{c.active ? "Pausar" : "Ativar"}</Button>
                      <Button variant="ghost" size="iconSm" icon={Pencil} onClick={() => openEdit(c)} aria-label="Editar" />
                      <Button variant="dangerGhost" size="iconSm" icon={Trash2} onClick={() => remove(c)} aria-label="Excluir" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ───── Formulário (painel lateral) ───── */}
      {form && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => !saving && setForm(null)} />
          <div className="relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col animate-fade-up [animation-duration:0.3s]">
            <div className="px-6 h-16 flex items-center justify-between border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">{form.id ? `Editar ${form.code}` : "Novo cupom"}</h2>
              <Button variant="ghost" size="icon" icon={X} onClick={() => setForm(null)} aria-label="Fechar" />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Código */}
              <section className="space-y-3">
                <div>
                  <label className={labelCls}>Código que o cliente digita</label>
                  <div className="flex gap-2">
                    <input
                      value={form.code}
                      onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                      placeholder="Ex.: BEMVINDO10"
                      maxLength={40}
                      className={`${inputCls} font-mono font-bold tracking-wider uppercase`}
                    />
                    <Button size="sm" icon={Sparkles} onClick={randomCode} className="shrink-0 self-center">Gerar</Button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Descrição interna (opcional)</label>
                  <input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex.: Influenciadora Maria — novembro" className={inputCls} />
                </div>
              </section>

              {/* Tipo */}
              <section className="space-y-3">
                <p className="text-sm font-semibold text-gray-900">Tipo de desconto</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { t: "PERCENT", label: "Porcentagem", icon: BadgePercent },
                    { t: "FIXED", label: "Valor fixo", icon: DollarSign },
                    { t: "FREE_SHIPPING", label: "Frete grátis", icon: Truck },
                  ] as const).map(({ t, label, icon: Icon }) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set("type", t)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold ring-1 transition-all ${form.type === t ? "ring-2 ring-[var(--brand)] bg-brand-light text-gray-900" : "ring-gray-200 text-gray-500 hover:bg-gray-50"}`}
                    >
                      <Icon size={18} className={form.type === t ? "text-brand" : ""} />
                      {label}
                    </button>
                  ))}
                </div>
                {form.type !== "FREE_SHIPPING" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>{form.type === "PERCENT" ? "Desconto (%)" : "Desconto (R$)"}</label>
                      <input inputMode="decimal" value={form.value} onChange={(e) => set("value", e.target.value)} placeholder={form.type === "PERCENT" ? "10" : "20,00"} className={inputCls} />
                    </div>
                    {form.type === "PERCENT" && (
                      <div>
                        <label className={labelCls}>Desconto máximo (R$, opcional)</label>
                        <input inputMode="decimal" value={form.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} placeholder="Sem teto" className={inputCls} />
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Regras */}
              <section className="space-y-3">
                <p className="text-sm font-semibold text-gray-900">Regras</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Pedido mínimo (R$)</label>
                    <input inputMode="decimal" value={form.minOrderValue} onChange={(e) => set("minOrderValue", e.target.value)} placeholder="Sem mínimo" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Limite total de usos</label>
                    <input inputMode="numeric" value={form.usageLimit} onChange={(e) => set("usageLimit", e.target.value.replace(/\D/g, ""))} placeholder="Ilimitado" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Começa em</label>
                    <input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Termina em</label>
                    <input type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Usos por cliente (CPF / e-mail)</label>
                  <div className="flex gap-2 items-center">
                    {([["1", "1 vez"], ["unlimited", "Ilimitado"], ["custom", "Outro"]] as const).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => set("perCustomer", v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ring-1 ${form.perCustomer === v ? "bg-gray-900 text-white ring-gray-900" : "ring-gray-200 text-gray-600 hover:bg-gray-50"}`}>{l}</button>
                    ))}
                    {form.perCustomer === "custom" && (
                      <input inputMode="numeric" value={form.perCustomerCustom} onChange={(e) => set("perCustomerCustom", e.target.value.replace(/\D/g, ""))} className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" aria-label="Usos por cliente" />
                    )}
                  </div>
                </div>
                <div className="space-y-3 pt-1">
                  <Toggle checked={form.firstPurchaseOnly} onChange={(v) => set("firstPurchaseOnly", v)} label="Só na primeira compra" hint="Recusa clientes que já têm pedido pago (confere CPF e e-mail)." />
                  <Toggle checked={form.stackWithPix} onChange={(v) => set("stackWithPix", v)} label="Acumula com o desconto do Pix" hint="Desligado: o cliente fica com o maior dos dois descontos." />
                  <Toggle
                    checked={form.showInChat}
                    onChange={(v) => set("showInChat", v)}
                    label="O atendente de IA pode divulgar este cupom"
                    hint="Ele oferece o cupom só quando o cliente está em dúvida, acha caro ou pede desconto."
                  />
                  <Toggle checked={form.active} onChange={(v) => set("active", v)} label="Cupom ativo" />
                </div>
              </section>

              {/* Restrição */}
              <section className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Onde o cupom vale</p>
                  <p className="text-xs text-gray-500">Sem nada selecionado, vale para a loja toda. O desconto e o pedido mínimo consideram só os produtos participantes.</p>
                </div>
                {categories.length > 0 && (
                  <div>
                    <label className={labelCls}>Categorias</label>
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((cat) => {
                        const on = form.categoryIds.includes(cat.id);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => set("categoryIds", on ? form.categoryIds.filter((x) => x !== cat.id) : [...form.categoryIds, cat.id])}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium ring-1 transition ${on ? "bg-brand text-white ring-transparent" : "ring-gray-200 text-gray-600 hover:bg-gray-50"}`}
                          >
                            {on && <Check size={11} className="inline mr-1 -mt-0.5" />}{cat.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <label className={labelCls}>Produtos específicos</label>
                  {form.productIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {form.productIds.map((id) => {
                        const p = products.find((x) => x.id === id);
                        return (
                          <span key={id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-gray-900 text-white text-xs">
                            {p?.name || "Produto removido"}
                            <button type="button" onClick={() => set("productIds", form.productIds.filter((x) => x !== id))} className="p-0.5 rounded-full hover:bg-white/20" aria-label="Remover"><X size={11} /></button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Buscar produto para adicionar…" className={`${inputCls} pl-8`} />
                  </div>
                  {filteredProducts.length > 0 && (
                    <ul className="mt-1 max-h-48 overflow-y-auto rounded-xl ring-1 ring-gray-200 divide-y divide-gray-50">
                      {filteredProducts.map((p) => {
                        const on = form.productIds.includes(p.id);
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => set("productIds", on ? form.productIds.filter((x) => x !== p.id) : [...form.productIds, p.id])}
                              className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50"
                            >
                              <span className="truncate">{p.name}</span>
                              {on ? <Check size={14} className="text-brand shrink-0" /> : <Plus size={14} className="text-gray-400 shrink-0" />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>

              {/* Resumo */}
              <div className="rounded-2xl bg-gray-900 text-white p-4">
                <p className="text-[11px] uppercase tracking-wider text-white/50 mb-1">Como o cliente vai ver</p>
                <p className="font-mono font-bold text-lg tracking-wider">{form.code || "CODIGO"}</p>
                <p className="text-sm text-white/80 mt-1">
                  {describe({
                    type: form.type,
                    value: Number(form.value.replace(",", ".")) || 0,
                    maxDiscount: Number(form.maxDiscount.replace(",", ".")) || null,
                    minOrderValue: Number(form.minOrderValue.replace(",", ".")) || null,
                    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
                    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
                    perCustomerLimit: form.perCustomer === "unlimited" ? null : form.perCustomer === "1" ? 1 : Number(form.perCustomerCustom) || null,
                    firstPurchaseOnly: form.firstPurchaseOnly,
                    stackWithPix: form.stackWithPix,
                    usageLimit: Number(form.usageLimit) || null,
                    restricted: form.productIds.length + form.categoryIds.length,
                  })}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-2">
              {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>Cancelar</Button>
                <Button variant="primary" onClick={save} disabled={!form.code} loading={saving} loadingText="Salvando…">
                  {form.id ? "Salvar alterações" : "Criar cupom"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
