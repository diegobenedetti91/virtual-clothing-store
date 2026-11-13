"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/admin/ui/Button";
import { AlertTriangle, ExternalLink, Filter, Link2, Lock, Pencil, Plus, Tag, Trash2, Wand2, X } from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  href: string;
  active: boolean;
  position: number;
  _count?: { products: number };
}
interface Category { id: string; name: string; slug: string; active: boolean }

const FIXED = [
  { label: "Início", href: "/" },
  { label: "Produtos", href: "/produtos" },
];

type Destination = "auto" | "category" | "custom";
interface FormState {
  id?: string;
  label: string;
  destination: Destination;
  categorySlug: string;
  customHref: string;
}

const SUGGESTIONS = ["Promoção 🔥", "Novidades ✨", "Lançamentos", "Black Friday", "Mais vendidos"];

const autoHref = (id: string) => `/produtos?menu=${id}`;

/** Descobre o tipo de destino de um item existente a partir do link salvo. */
function destinationOf(item: NavItem, categories: Category[]): { type: Destination; label: string; categorySlug?: string } {
  if (item.href === autoHref(item.id)) return { type: "auto", label: "Produtos marcados com este menu" };
  const m = item.href.match(/^\/produtos\?category=([^&]+)$/);
  if (m) {
    const cat = categories.find((c) => c.slug === decodeURIComponent(m[1]));
    return { type: "category", label: `Categoria ${cat?.name ?? m[1]}`, categorySlug: decodeURIComponent(m[1]) };
  }
  return { type: "custom", label: item.href };
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${checked ? "bg-brand" : "bg-gray-300"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
    </button>
  );
}

export default function AdminMenuPage() {
  const [items, setItems] = useState<NavItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/nav-items").then((r) => r.json()), fetch("/api/categories").then((r) => r.json()).catch(() => [])])
      .then(([navs, cats]) => {
        if (cancelled) return;
        setItems(Array.isArray(navs) ? navs : []);
        setCategories(Array.isArray(cats) ? cats.filter((c: Category) => c.active) : []);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  const openNew = (label = "") => {
    setError("");
    setForm({ label, destination: "auto", categorySlug: categories[0]?.slug ?? "", customHref: "" });
  };
  const openEdit = (item: NavItem) => {
    setError("");
    const d = destinationOf(item, categories);
    setForm({ id: item.id, label: item.label, destination: d.type, categorySlug: d.categorySlug ?? categories[0]?.slug ?? "", customHref: d.type === "custom" ? item.href : "" });
  };

  /** Link que será salvo conforme o destino escolhido ("" = a API gera o filtro automático). */
  const hrefFor = (f: FormState) =>
    f.destination === "auto" ? (f.id ? autoHref(f.id) : "") : f.destination === "category" ? `/produtos?category=${f.categorySlug}` : f.customHref.trim();

  const save = async () => {
    if (!form) return;
    setError("");
    if (!form.label.trim()) return setError("Informe o nome do item");
    if (form.destination === "category" && !form.categorySlug) return setError("Escolha a categoria");
    if (form.destination === "custom" && !form.customHref.trim()) return setError("Informe o link de destino");
    setSaving(true);
    try {
      if (form.id) {
        const res = await fetch(`/api/nav-items/${form.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: form.label.trim(), href: hrefFor(form) }),
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        // A rota de edição não devolve a contagem de produtos: mantém a anterior
        setItems((prev) => prev.map((i) => (i.id === form.id ? { ...i, ...updated, _count: i._count } : i)));
      } else {
        const res = await fetch("/api/nav-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: form.label.trim(), href: hrefFor(form) }),
        });
        if (!res.ok) throw new Error();
        const item = await res.json();
        setItems((prev) => [...prev, item]);
      }
      setForm(null);
    } catch {
      setError("Não foi possível salvar. Tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: NavItem) => {
    const n = item._count?.products ?? 0;
    if (!confirm(n > 0 ? `Remover “${item.label}” do menu? ${n} produto(s) deixam de estar marcados com ele.` : `Remover “${item.label}” do menu?`)) return;
    await fetch(`/api/nav-items/${item.id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const handleFixHref = async (item: NavItem) => {
    const res = await fetch(`/api/nav-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ href: autoHref(item.id) }),
    });
    const updated = await res.json();
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, href: updated.href } : i)));
  };

  const handleToggle = async (item: NavItem) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, active: !item.active } : i)));
    const res = await fetch(`/api/nav-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    if (!res.ok) setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, active: item.active } : i)));
  };

  const visibleItems = items.filter((i) => i.active);
  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Menu da loja</h1>
          <p className="text-sm text-gray-500 mt-1">Links que aparecem no cabeçalho e no menu lateral da loja. Início e Produtos são fixos.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => openNew()} className="shrink-0">
          Novo item
        </Button>
      </div>

      {/* Prévia */}
      <section className="rounded-2xl ring-1 ring-gray-200/70 overflow-hidden bg-white">
        <div className="px-4 py-2 text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">Como aparece na loja</div>
        <div className="px-4 py-3 flex flex-wrap items-center gap-1.5">
          <span className="px-3 py-1.5 rounded-full text-[13px] font-semibold bg-gray-900 text-white">Início</span>
          <span className="px-3 py-1.5 rounded-full text-[13px] font-semibold text-gray-600">Produtos</span>
          {visibleItems.map((i) => (
            <span key={i.id} className="px-3 py-1.5 rounded-full text-[13px] font-semibold text-gray-600">{i.label}</span>
          ))}
          {categories.length > 0 && <span className="w-px h-4 bg-gray-200 mx-1" />}
          {categories.slice(0, 4).map((c) => (
            <span key={c.id} className="px-3 py-1.5 rounded-full text-[13px] text-gray-400">{c.name}</span>
          ))}
          {categories.length > 4 && <span className="text-xs text-gray-300">…</span>}
        </div>
        <p className="px-4 pb-3 text-[11px] text-gray-400">As categorias ativas aparecem depois dos itens do menu automaticamente.</p>
      </section>

      {/* Itens */}
      <section className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <ul className="divide-y divide-gray-100">
          {FIXED.map((f) => (
            <li key={f.href} className="flex items-center gap-3 px-5 py-3.5">
              <span className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><Lock size={15} className="text-gray-300" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700">{f.label}</p>
                <p className="text-xs text-gray-400">{f.href}</p>
              </div>
              <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Fixo</span>
            </li>
          ))}

          {!loaded ? (
            Array.from({ length: 2 }).map((_, i) => <li key={i} className="px-5 py-3"><div className="img-skeleton rounded-xl h-10" /></li>)
          ) : items.length === 0 ? (
            <li className="px-5 py-10 text-center">
              <p className="font-medium text-gray-700">Nenhum item personalizado</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">Crie atalhos como “Promoção” ou “Novidades” para destacar coleções no cabeçalho.</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} size="xs" icon={Plus} onClick={() => openNew(s)} className="rounded-full">{s}</Button>
                ))}
              </div>
            </li>
          ) : (
            items.map((item) => {
              const d = destinationOf(item, categories);
              const n = item._count?.products ?? 0;
              const brokenFilter = n > 0 && d.type !== "auto";
              const Icon = d.type === "auto" ? Filter : d.type === "category" ? Tag : Link2;
              return (
                <li key={item.id} className={`group flex items-center gap-3 px-5 py-3.5 transition ${item.active ? "" : "bg-gray-50/60"}`}>
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.active ? "bg-brand-light text-brand" : "bg-gray-100 text-gray-400"}`}><Icon size={15} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-medium ${item.active ? "text-gray-900" : "text-gray-500"}`}>{item.label}</p>
                      {!item.active && <span className="text-[10px] font-semibold bg-gray-200 text-gray-500 rounded-full px-1.5 py-0.5">oculto</span>}
                      {n > 0 && <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">{n} produto{n !== 1 ? "s" : ""}</span>}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{d.label}</p>
                    {brokenFilter && (
                      <button type="button" onClick={() => handleFixHref(item)} className="mt-1 inline-flex items-center gap-1 rounded text-[11px] font-medium text-amber-700 hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400" title="O link não mostra os produtos marcados com este menu">
                        <AlertTriangle size={11} /> O link ignora os {n} produtos marcados — corrigir
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Toggle checked={item.active} onChange={() => handleToggle(item)} label={item.active ? "Ocultar do menu" : "Mostrar no menu"} />
                    <ButtonLink href={item.href} target="_blank" variant="ghost" size="iconSm" icon={ExternalLink} aria-label="Abrir na loja" title="Abrir na loja" className="ml-1 text-gray-400" />
                    <Button variant="ghost" size="iconSm" icon={Pencil} onClick={() => openEdit(item)} aria-label="Editar" className="text-gray-400" />
                    <Button variant="dangerGhost" size="iconSm" icon={Trash2} onClick={() => handleDelete(item)} aria-label="Excluir" />
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <p className="text-xs text-gray-500 flex items-start gap-1.5">
        <Wand2 size={13} className="shrink-0 mt-0.5" />
        Para colocar produtos em um item do tipo “Produtos marcados”, abra o produto e marque o menu em “Menus da loja”.
      </p>

      {/* Formulário */}
      {form && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => !saving && setForm(null)} />
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-fade-up [animation-duration:0.3s]">
            <div className="px-6 h-16 flex items-center justify-between border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">{form.id ? "Editar item" : "Novo item do menu"}</h2>
              <Button variant="ghost" size="icon" icon={X} onClick={() => setForm(null)} aria-label="Fechar" className="-mr-2 text-gray-400" />
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome no menu</label>
                <input autoFocus value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={inputCls} placeholder="Ex.: Promoção" maxLength={40} />
                {!form.id && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => setForm({ ...form, label: s })} className="text-[11px] px-2.5 py-1 rounded-full ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50">{s}</button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="block text-xs font-medium text-gray-600 mb-2">Ao clicar, abre…</p>
                <div className="space-y-2">
                  {([
                    ["auto", "Produtos marcados com este menu", "Você escolhe os produtos no cadastro de cada um.", Filter],
                    ["category", "Uma categoria", "Mostra todos os produtos da categoria.", Tag],
                    ["custom", "Um link", "Qualquer página da loja ou site externo.", Link2],
                  ] as const).map(([v, title, hint, Icon]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm({ ...form, destination: v })}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl text-left ring-1 transition ${form.destination === v ? "ring-2 ring-[var(--brand)] bg-brand-light" : "ring-gray-200 hover:bg-gray-50"}`}
                    >
                      <Icon size={16} className={form.destination === v ? "text-brand mt-0.5" : "text-gray-400 mt-0.5"} />
                      <span>
                        <span className="block text-sm font-medium text-gray-900">{title}</span>
                        <span className="block text-xs text-gray-500">{hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {form.destination === "category" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
                  {categories.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhuma categoria ativa. Crie em Catálogo → Categorias.</p>
                  ) : (
                    <select value={form.categorySlug} onChange={(e) => setForm({ ...form, categorySlug: e.target.value })} className={inputCls}>
                      {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                    </select>
                  )}
                </div>
              )}
              {form.destination === "custom" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Link</label>
                  <input value={form.customHref} onChange={(e) => setForm({ ...form, customHref: e.target.value })} className={`${inputCls} font-mono`} placeholder="/produtos?search=vestido ou https://…" />
                  <p className="text-xs text-gray-400 mt-1">Comece com / para páginas da loja.</p>
                </div>
              )}

              {/* Prévia do item */}
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-[11px] text-gray-400 mb-2">Prévia</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-3 py-1.5 rounded-full text-[13px] font-semibold text-gray-600">Produtos</span>
                  <span className="px-3 py-1.5 rounded-full text-[13px] font-semibold bg-gray-900 text-white">{form.label || "Novo item"}</span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-2">
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>Cancelar</Button>
                <Button variant="primary" onClick={save} loading={saving} loadingText="Salvando…">
                  {form.id ? "Salvar" : "Adicionar ao menu"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
