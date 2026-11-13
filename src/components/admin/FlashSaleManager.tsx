"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/admin/ui/Button";
import { BadgePercent, Calendar, Check, DollarSign, ExternalLink, Package, Pencil, Plus, Search, Timer, Trash2, X, Zap } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface FlashSale {
  id: string;
  title: string;
  productId: string | null;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  startAt: string;
  endAt: string;
  active: boolean;
  product: { id: string; name: string; slug: string; price: number; images?: string | null } | null;
}
interface ProductOption { id: string; name: string; price: number; images?: string | null; active?: boolean }

interface FormState {
  id?: string;
  title: string;
  productId: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: string;
  startAt: string;
  endAt: string;
}

const firstImage = (raw?: string | null) => { try { const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? (v[0] as string) ?? null : null; } catch { return null; } };
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const finalPrice = (price: number, type: string, value: number) =>
  Math.max(0.01, Math.round((type === "FIXED" ? price - value : price * (1 - value / 100)) * 100) / 100);

function remaining(ms: number) {
  if (ms <= 0) return "0s";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white";
const labelCls = "block text-xs font-medium text-gray-600 mb-1";

export default function FlashSaleManager() {
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(0);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/admin/flash-sales").then((r) => r.json()), fetch("/api/products?admin=1").then((r) => r.json())])
      .then(([s, p]) => {
        if (cancelled) return;
        setSales(Array.isArray(s) ? s : []);
        // A API de produtos devolve a lista direto (antes o formulário lia `data.data` e ficava vazio)
        setProducts(Array.isArray(p) ? p : Array.isArray(p?.data) ? p.data : []);
        setLoaded(true);
        setNow(Date.now());
      });
    return () => { cancelled = true; };
  }, [reload]);

  // Relógio para as contagens regressivas
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const statusOf = (s: FlashSale) => {
    const start = new Date(s.startAt).getTime();
    const end = new Date(s.endAt).getTime();
    if (!s.active) return { key: "paused", label: "Pausada", tone: "bg-gray-100 text-gray-600 ring-gray-200" };
    if (now > end) return { key: "ended", label: "Encerrada", tone: "bg-gray-100 text-gray-500 ring-gray-200" };
    if (now < start) return { key: "scheduled", label: "Agendada", tone: "bg-blue-50 text-blue-700 ring-blue-200" };
    return { key: "live", label: "No ar", tone: "bg-red-50 text-red-700 ring-red-200" };
  };

  const minute = Math.floor(now / 60000);
  const sorted = useMemo(() => {
    const order: Record<string, number> = { live: 0, scheduled: 1, paused: 2, ended: 3 };
    return [...sales].sort((a, b) => order[statusOf(a).key] - order[statusOf(b).key] || new Date(a.endAt).getTime() - new Date(b.endAt).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, minute]);

  const liveCount = sales.filter((s) => statusOf(s).key === "live").length;

  const openNew = () => {
    const start = new Date();
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    setFormError(null);
    setProductQuery("");
    setForm({ title: "", productId: "", discountType: "PERCENT", discountValue: "", startAt: toLocalInput(start), endAt: toLocalInput(end) });
  };
  const openEdit = (s: FlashSale) => {
    setFormError(null);
    setProductQuery("");
    setForm({
      id: s.id, title: s.title, productId: s.productId || "", discountType: s.discountType, discountValue: String(s.discountValue),
      startAt: toLocalInput(new Date(s.startAt)), endAt: toLocalInput(new Date(s.endAt)),
    });
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/flash-sales", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(form.id ? { id: form.id } : {}),
          title: form.title,
          productId: form.productId,
          discountType: form.discountType,
          discountValue: form.discountValue,
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
        }),
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

  const toggle = async (s: FlashSale) => {
    setSales((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !s.active } : x)));
    await fetch("/api/admin/flash-sales", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: s.id, active: !s.active }) });
  };

  const remove = async (s: FlashSale) => {
    if (!confirm(`Excluir a promoção "${s.title}"?`)) return;
    await fetch(`/api/admin/flash-sales?id=${s.id}`, { method: "DELETE" });
    setReload((n) => n + 1);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const selectedProduct = form ? products.find((p) => p.id === form.productId) : undefined;
  const value = form ? Number(form.discountValue.replace(",", ".")) || 0 : 0;
  const preview = selectedProduct && value > 0 ? finalPrice(selectedProduct.price, form!.discountType, value) : null;
  const matches = productQuery.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(productQuery.trim().toLowerCase())).slice(0, 25)
    : products.slice(0, 25);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
            Promoções relâmpago
            {liveCount > 0 && <span className="inline-flex items-center gap-1 text-xs font-semibold bg-red-500 text-white rounded-full px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />{liveCount} no ar</span>}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Desconto com tempo limitado em um produto. A loja mostra o preço promocional, o selo ⚡ e um cronômetro — e o checkout cobra o preço da promoção.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openNew} className="shrink-0 self-start sm:self-auto">
          Nova promoção
        </Button>
      </div>

      {!loaded ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-56" />)}</div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <Zap size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">Nenhuma promoção relâmpago ainda</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">Ex.: 30% no vestido mais vendido só até meia-noite.</p>
          <Button variant="dark" size="sm" icon={Plus} onClick={openNew}>Criar promoção</Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((s) => {
            const st = statusOf(s);
            const img = firstImage(s.product?.images);
            const price = s.product?.price ?? 0;
            const promo = finalPrice(price, s.discountType, s.discountValue);
            const pct = price ? Math.round(((price - promo) / price) * 100) : 0;
            const start = new Date(s.startAt).getTime();
            const end = new Date(s.endAt).getTime();
            const progress = st.key === "live" ? Math.min(100, ((now - start) / (end - start)) * 100) : st.key === "ended" ? 100 : 0;
            return (
              <div key={s.id} className={`bg-white rounded-2xl border shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col transition-shadow hover:shadow-md ${st.key === "live" ? "border-red-200" : "border-gray-200/70"}`}>
                <div className="flex gap-3 p-4">
                  <span className="relative w-20 h-24 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                    {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <Package size={20} className="m-auto mt-9 text-gray-400" />}
                    <span className="absolute top-1 left-1 text-[10px] font-bold bg-red-600 text-white rounded-full px-1.5 py-0.5">-{pct}%</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.title}</p>
                      <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${st.tone}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{s.product?.name || "Produto removido"}</p>
                    <p className="mt-2 flex items-baseline gap-2">
                      <span className="text-lg font-semibold text-gray-900 tabular-nums">{formatCurrency(promo)}</span>
                      <span className="text-xs text-gray-400 line-through tabular-nums">{formatCurrency(price)}</span>
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{s.discountType === "FIXED" ? `${formatCurrency(s.discountValue)} de desconto` : `${s.discountValue}% de desconto`}</p>
                  </div>
                </div>

                <div className="px-4 pb-3">
                  <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                    <span className="inline-flex items-center gap-1"><Calendar size={11} />{new Date(s.startAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} → {new Date(s.endAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full ${st.key === "live" ? "bg-red-500" : "bg-gray-300"}`} style={{ width: `${progress}%` }} />
                  </div>
                  <p className={`mt-1.5 text-xs font-medium inline-flex items-center gap-1 ${st.key === "live" ? "text-red-600" : "text-gray-500"}`}>
                    <Timer size={12} />
                    {st.key === "live" ? <>Termina em <span className="font-mono tabular-nums">{remaining(end - now)}</span></> : st.key === "scheduled" ? <>Começa em <span className="font-mono tabular-nums">{remaining(start - now)}</span></> : st.key === "ended" ? "Encerrada" : "Pausada — não aparece na loja"}
                  </p>
                </div>

                <div className="mt-auto flex items-center gap-1 px-3 py-2 border-t border-gray-100">
                  {s.product && (
                    <ButtonLink href={`/produtos/${s.product.slug}`} target="_blank" variant="ghost" size="xs" icon={ExternalLink}>
                      Ver na loja
                    </ButtonLink>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    {st.key !== "ended" && <Button variant="ghost" size="xs" onClick={() => toggle(s)}>{s.active ? "Pausar" : "Ativar"}</Button>}
                    <Button variant="ghost" size="iconSm" icon={Pencil} onClick={() => openEdit(s)} aria-label="Editar" />
                    <Button variant="dangerGhost" size="iconSm" icon={Trash2} onClick={() => remove(s)} aria-label="Excluir" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Formulário */}
      {form && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => !saving && setForm(null)} />
          <div className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col animate-fade-up [animation-duration:0.3s]">
            <div className="px-6 h-16 flex items-center justify-between border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">{form.id ? "Editar promoção" : "Nova promoção relâmpago"}</h2>
              <Button variant="ghost" size="icon" icon={X} onClick={() => setForm(null)} aria-label="Fechar" />
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className={labelCls}>Nome da promoção (aparece no cronômetro)</label>
                <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Oferta relâmpago de sexta" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Produto</label>
                {selectedProduct ? (
                  <div className="flex items-center gap-3 rounded-xl ring-1 ring-gray-200 p-2.5">
                    <span className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                      {firstImage(selectedProduct.images) ? <img src={firstImage(selectedProduct.images)!} alt="" className="w-full h-full object-cover" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{selectedProduct.name}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(selectedProduct.price)}</p>
                    </div>
                    <Button variant="ghost" size="xs" onClick={() => set("productId", "")}>Trocar</Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input autoFocus value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Buscar produto…" className={`${inputCls} pl-8`} />
                    </div>
                    <ul className="mt-1 max-h-64 overflow-y-auto rounded-xl ring-1 ring-gray-200 divide-y divide-gray-50">
                      {matches.length === 0 && <li className="px-3 py-4 text-sm text-gray-400 text-center">Nenhum produto encontrado</li>}
                      {matches.map((p) => (
                        <li key={p.id}>
                          <button type="button" onClick={() => set("productId", p.id)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50">
                            <span className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden shrink-0">{firstImage(p.images) ? <img src={firstImage(p.images)!} alt="" className="w-full h-full object-cover" /> : null}</span>
                            <span className="min-w-0 flex-1 text-sm text-gray-800 truncate">{p.name}{p.active === false && <span className="text-xs text-gray-400"> · inativo</span>}</span>
                            <span className="text-xs text-gray-500 tabular-nums">{formatCurrency(p.price)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <div>
                <label className={labelCls}>Desconto</label>
                <div className="flex gap-2">
                  <div className="inline-flex rounded-xl bg-gray-100 p-1 shrink-0">
                    {([["PERCENT", "%", BadgePercent], ["FIXED", "R$", DollarSign]] as const).map(([t, l, Icon]) => (
                      <button key={t} type="button" onClick={() => set("discountType", t)} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${form.discountType === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
                        <Icon size={13} /> {l}
                      </button>
                    ))}
                  </div>
                  <input inputMode="decimal" value={form.discountValue} onChange={(e) => set("discountValue", e.target.value)} placeholder={form.discountType === "PERCENT" ? "Ex.: 20" : "Ex.: 30,00"} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Começa</label>
                  <input type="datetime-local" value={form.startAt} onChange={(e) => set("startAt", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Termina</label>
                  <input type="datetime-local" value={form.endAt} onChange={(e) => set("endAt", e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[["3 horas", 3], ["Até meia-noite", -1], ["24 horas", 24], ["3 dias", 72], ["7 dias", 168]].map(([label, h]) => (
                  <button
                    key={label as string}
                    type="button"
                    onClick={() => {
                      const start = form.startAt ? new Date(form.startAt) : new Date();
                      const end = h === -1 ? new Date(new Date(start).setHours(23, 59, 0, 0)) : new Date(start.getTime() + (h as number) * 3600000);
                      set("endAt", toLocalInput(end));
                    }}
                    className="text-xs px-2.5 py-1 rounded-full ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    {label as string}
                  </button>
                ))}
              </div>

              {/* Prévia */}
              <div className="rounded-2xl bg-gray-900 text-white p-4">
                <p className="text-[11px] uppercase tracking-wider text-white/50 mb-2">Como aparece na loja</p>
                {selectedProduct && preview != null ? (
                  <>
                    <p className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-600 rounded-full px-2 py-0.5 uppercase"><Zap size={10} fill="white" /> Flash</p>
                    <p className="mt-2 text-sm text-white/80">{selectedProduct.name}</p>
                    <p className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-semibold tabular-nums">{formatCurrency(preview)}</span>
                      <span className="text-sm text-white/50 line-through tabular-nums">{formatCurrency(selectedProduct.price)}</span>
                      <span className="text-xs font-semibold text-red-300">-{Math.round(((selectedProduct.price - preview) / selectedProduct.price) * 100)}%</span>
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-white/60">Escolha o produto e o desconto para ver a prévia.</p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-2">
              {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>Cancelar</Button>
                <Button variant="primary" icon={Check} onClick={save} disabled={!form.productId || !form.title} loading={saving} loadingText="Salvando…">
                  {form.id ? "Salvar" : "Criar promoção"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
