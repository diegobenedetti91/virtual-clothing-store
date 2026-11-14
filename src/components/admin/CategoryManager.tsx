"use client";

import { useMemo, useState } from "react";
import { confirmDialog } from "@/lib/notify";
import OptimizedImg from "@/components/OptimizedImg";
import { Button, ButtonLink } from "@/components/admin/ui/Button";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ExternalLink, Pencil, Plus, Search, Tag, Trash2, X } from "lucide-react";
import { Category } from "@/types";
import ImageUpload from "./ImageUpload";

interface Props {
  initialCategories: Category[];
}

interface FormState {
  id?: string;
  name: string;
  image: string;
  active: boolean;
}

// Mesmas cores usadas na home para categorias sem imagem
const CATEGORY_BG = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444"];

function slugPreview(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={onChange}
      className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${checked ? "bg-brand" : "bg-gray-300"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
    </button>
  );
}

export default function CategoryManager({ initialCategories }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? categories.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)) : categories;
  }, [categories, query]);

  const totalProducts = categories.reduce((s, c) => s + (c._count?.products || 0), 0);
  const indexOf = (id: string) => Math.max(0, categories.findIndex((c) => c.id === id));

  const openNew = () => { setFormError(null); setForm({ name: "", image: "", active: true }); };
  const openEdit = (c: Category) => { setFormError(null); setForm({ id: c.id, name: c.name, image: c.image || "", active: c.active !== false }); };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) { setFormError("Dê um nome para a categoria"); return; }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(form.id ? `/api/categories/${form.id}` : "/api/categories", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), image: form.image, active: form.active }),
      });
      if (!res.ok) throw new Error("Não foi possível salvar a categoria");
      const cat = (await res.json()) as Category;
      setCategories((prev) =>
        (form.id ? prev.map((c) => (c.id === form.id ? cat : c)) : [...prev, cat]).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      );
      setForm(null);
      router.refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  // Ativar/desativar sem abrir o formulário (a API exige nome e imagem no PUT)
  const toggleActive = async (c: Category) => {
    const next = c.active === false;
    setCategories((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: next } : x)));
    const res = await fetch(`/api/categories/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: c.name, image: c.image || "", active: next }),
    });
    if (!res.ok) {
      setCategories((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: !next } : x)));
      setNotice("Não foi possível alterar a categoria. Tente novamente.");
      return;
    }
    router.refresh();
  };

  const remove = async (c: Category) => {
    const count = c._count?.products || 0;
    if (count > 0) {
      // Todo produto precisa de uma categoria: o banco não deixa excluir enquanto houver produtos nela
      setNotice(`"${c.name}" tem ${count} produto${count !== 1 ? "s" : ""}. Mova-os para outra categoria ou desative a categoria para escondê-la da loja.`);
      return;
    }
    if (!(await confirmDialog({ title: `Excluir a categoria “${c.name}”?`, message: "Ela some do menu e da loja. Essa ação não pode ser desfeita.", confirmText: "Excluir", tone: "danger" }))) return;
    const res = await fetch(`/api/categories/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      setNotice(`Não foi possível excluir "${c.name}". Verifique se ainda há produtos nela.`);
      return;
    }
    setCategories((prev) => prev.filter((x) => x.id !== c.id));
    router.refresh();
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const previewColor = CATEGORY_BG[(form?.id ? indexOf(form.id) : categories.length) % CATEGORY_BG.length];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Categorias</h1>
          <p className="text-sm text-gray-500 mt-1">
            Organize os produtos da loja. Categorias ativas aparecem em &ldquo;Compre por categoria&rdquo;, no menu e nos filtros.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openNew} className="shrink-0">
          Nova categoria
        </Button>
      </div>

      {notice && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
          <p className="flex-1">{notice}</p>
          <Button variant="ghost" size="iconSm" icon={X} onClick={() => setNotice(null)} aria-label="Fechar" className="-my-1 -mr-1 shrink-0 text-amber-700/70 hover:bg-amber-100 hover:text-amber-900" />
        </div>
      )}

      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar categoria…" className="w-full pl-8 pr-3 py-2 text-[13px] rounded-xl border border-gray-200 bg-white" />
          </label>
          <p className="text-xs text-gray-500">
            {categories.length} categoria{categories.length !== 1 ? "s" : ""} · {totalProducts} produto{totalProducts !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center px-4">
          <Tag size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">Nenhuma categoria ainda</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">Ex.: Vestidos, Blusas, Calças, Acessórios — com uma foto para o círculo da home.</p>
          <Button variant="dark" size="sm" icon={Plus} onClick={openNew}>Criar categoria</Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">Nenhuma categoria encontrada para &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const count = c._count?.products || 0;
            const active = c.active !== false;
            return (
              <div key={c.id} className={`group bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow p-4 flex items-center gap-4 ${active ? "" : "opacity-70"}`}>
                <span className="w-16 h-16 rounded-full overflow-hidden shrink-0 ring-2 ring-gray-100 flex items-center justify-center" style={c.image ? undefined : { background: CATEGORY_BG[indexOf(c.id) % CATEGORY_BG.length] }}>
                  {c.image ? <OptimizedImg widths={[160]} sizes="48px" loading="lazy" src={c.image} alt={c.name} className="w-full h-full object-cover" /> : <span className="text-white font-black text-xl">{c.name[0]?.toUpperCase()}</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                    {!active && <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">oculta</span>}
                  </div>
                  <p className="text-xs text-gray-400 truncate font-mono">/{c.slug}</p>
                  <p className="text-xs text-gray-600 mt-1">{count} produto{count !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Toggle checked={active} onChange={() => toggleActive(c)} label={active ? "Ocultar da loja" : "Mostrar na loja"} />
                  <div className="flex items-center gap-1">
                    <ButtonLink href={`/produtos?category=${c.slug}`} target="_blank" variant="ghost" size="iconSm" icon={ExternalLink} aria-label="Ver na loja" title="Ver na loja" />
                    <Button variant="ghost" size="iconSm" icon={Pencil} onClick={() => openEdit(c)} aria-label="Editar" />
                    <Button variant="dangerGhost" size="iconSm" icon={Trash2} onClick={() => remove(c)} aria-label="Excluir" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Formulário (painel lateral) */}
      {form && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => !saving && setForm(null)} />
          <div className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col animate-fade-up [animation-duration:0.3s]">
            <div className="px-6 h-16 flex items-center justify-between border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">{form.id ? "Editar categoria" : "Nova categoria"}</h2>
              <Button variant="ghost" size="icon" icon={X} onClick={() => setForm(null)} aria-label="Fechar" />
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
                  placeholder="Ex.: Vestidos"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                />
                {form.name.trim() && <p className="text-[11px] text-gray-400 mt-1 font-mono">Endereço: /produtos?category={slugPreview(form.name)}</p>}
              </div>

              <ImageUpload value={form.image} onChange={(url) => set("image", url)} label="Foto da categoria (opcional)" aspect="square" />

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <Toggle checked={form.active} onChange={() => set("active", !form.active)} label="Mostrar na loja" />
                <span>
                  <span className="block text-sm font-medium text-gray-900">Mostrar na loja</span>
                  <span className="block text-xs text-gray-500">Desligado: a categoria some do menu e da home, mas os produtos continuam nela.</span>
                </span>
              </label>

              {/* Prévia do círculo da home */}
              <div className="rounded-2xl bg-gray-50 ring-1 ring-gray-200/70 p-5 text-center">
                <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-3">Como aparece em &ldquo;Compre por categoria&rdquo;</p>
                <span className="mx-auto w-28 h-28 rounded-full overflow-hidden border-2 border-gray-200 flex items-center justify-center shadow-sm" style={form.image ? undefined : { background: previewColor }}>
                  {form.image ? <img src={form.image} alt="" className="w-full h-full object-cover object-top" /> : <span className="text-white font-black text-2xl">{form.name.trim()[0]?.toUpperCase() || "?"}</span>}
                </span>
                <p className="mt-3 text-sm font-medium text-gray-700">{form.name.trim() || "Nome da categoria"}</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-2">
              {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>Cancelar</Button>
                <Button variant="primary" icon={Check} onClick={save} loading={saving} loadingText="Salvando…" disabled={!form.name.trim()}>
                  {form.id ? "Salvar" : "Criar categoria"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
