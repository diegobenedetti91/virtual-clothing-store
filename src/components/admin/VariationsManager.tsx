"use client";

import { useState } from "react";
import { Check, Layers, Pencil, Plus, Trash2, X } from "lucide-react";
import { isColorAttribute, swatchBackground } from "@/lib/colorSwatch";
import { Button } from "@/components/admin/ui/Button";

interface VariationTemplate {
  id: string;
  name: string;
  values: string;
  active: boolean;
}

interface Props {
  initialTemplates: VariationTemplate[];
}

interface FormState {
  id?: string;
  name: string;
  values: string[];
}

// Atalhos para montar modelos comuns mais rápido
const QUICK: { label: string; name?: string; values: string[] }[] = [
  { label: "Tamanhos P–GG", name: "Tamanho", values: ["PP", "P", "M", "G", "GG"] },
  { label: "Numeração 36–46", name: "Tamanho", values: ["36", "38", "40", "42", "44", "46"] },
  { label: "Tamanho único", name: "Tamanho", values: ["Único"] },
  { label: "Cores básicas", name: "Cor", values: ["Preto", "Branco", "Off-white", "Bege", "Cinza", "Marrom"] },
  { label: "Cores vivas", name: "Cor", values: ["Vermelho", "Rosa", "Azul", "Verde", "Amarelo", "Lilás"] },
];

const parseValues = (raw: string) => {
  try { const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? (v as string[]) : []; } catch { return []; }
};

function Chip({ value, color, onRemove }: { value: string; color: boolean; onRemove?: () => void }) {
  const swatch = color ? swatchBackground(value) : null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium ${swatch ? "pl-1 pr-2.5" : "px-2.5"} py-1`}>
      {swatch && <span className="w-4 h-4 rounded-full ring-1 ring-black/10" style={{ background: swatch }} />}
      {value}
      {onRemove && (
        <button type="button" onClick={onRemove} className="-mr-1 p-0.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-white" aria-label={`Remover ${value}`}>
          <X size={11} />
        </button>
      )}
    </span>
  );
}

export default function VariationsManager({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [form, setForm] = useState<FormState | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const openNew = () => { setError(""); setDraft(""); setForm({ name: "", values: [] }); };
  const openEdit = (t: VariationTemplate) => { setError(""); setDraft(""); setForm({ id: t.id, name: t.name, values: parseValues(t.values) }); };

  // Enter, vírgula ou ponto e vírgula adicionam; aceita colar "P, M, G"
  const addValues = (text: string) => {
    const parts = text.split(/[,;\n]/).map((v) => v.trim()).filter(Boolean);
    if (!parts.length) return;
    setForm((f) => (f ? { ...f, values: [...f.values, ...parts.filter((p) => !f.values.some((x) => x.toLowerCase() === p.toLowerCase()))] } : f));
    setDraft("");
  };

  const applyQuick = (q: (typeof QUICK)[number]) =>
    setForm((f) => (f ? { name: f.name.trim() ? f.name : q.name || f.name, id: f.id, values: [...f.values, ...q.values.filter((v) => !f.values.includes(v))] } : f));

  const save = async () => {
    if (!form) return;
    const pending = draft.trim();
    const values = pending ? [...form.values, ...pending.split(/[,;]/).map((v) => v.trim()).filter((v) => v && !form.values.includes(v))] : form.values;
    if (!form.name.trim()) { setError("Informe o nome da variação"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/variations", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.id ? { id: form.id, name: form.name.trim(), values } : { name: form.name.trim(), values }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Erro ao salvar");
        return;
      }
      const saved = (await res.json()) as VariationTemplate;
      setTemplates((p) => (form.id ? p.map((t) => (t.id === form.id ? saved : t)) : [...p, saved]).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      setForm(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: VariationTemplate) => {
    if (!confirm(`Remover a variação "${t.name}"? Produtos já criados não serão afetados.`)) return;
    await fetch(`/api/admin/variations?id=${t.id}`, { method: "DELETE" });
    setTemplates((p) => p.filter((x) => x.id !== t.id));
  };

  const handleToggleActive = async (t: VariationTemplate) => {
    const res = await fetch("/api/admin/variations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, active: !t.active }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTemplates((p) => p.map((x) => (x.id === t.id ? updated : x)));
    }
  };

  const moveValue = (i: number, dir: -1 | 1) =>
    setForm((f) => {
      if (!f) return f;
      const j = i + dir;
      if (j < 0 || j >= f.values.length) return f;
      const values = [...f.values];
      [values[i], values[j]] = [values[j], values[i]];
      return { ...f, values };
    });

  const isColor = form ? isColorAttribute(form.name) : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Variações</h1>
          <p className="text-sm text-gray-500 mt-1">Modelos reutilizáveis de tamanhos, cores e outros atributos. No cadastro do produto, é só escolher e aplicar.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openNew} className="shrink-0">
          Nova variação
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center px-4">
          <Layers size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">Nenhuma variação cadastrada</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">Ex.: &ldquo;Tamanho&rdquo; com P, M, G, GG ou &ldquo;Cor&rdquo; com Preto, Branco, Bege.</p>
          <Button variant="dark" size="sm" icon={Plus} onClick={openNew}>Criar variação</Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => {
            const values = parseValues(t.values);
            const color = isColorAttribute(t.name);
            return (
              <div key={t.id} className={`bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow p-4 flex flex-col ${t.active ? "" : "opacity-70"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                      {!t.active && <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">inativa</span>}
                    </div>
                    <p className="text-xs text-gray-500">{values.length} {values.length === 1 ? "opção" : "opções"}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={t.active}
                    onClick={() => handleToggleActive(t)}
                    title={t.active ? "Desativar" : "Ativar"}
                    className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${t.active ? "bg-brand" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${t.active ? "translate-x-4" : ""}`} />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap content-start items-start gap-1.5 flex-1">
                  {values.length > 0 ? values.slice(0, 14).map((v) => <Chip key={v} value={v} color={color} />) : <span className="text-xs text-gray-400 italic">Sem valores cadastrados</span>}
                  {values.length > 14 && <span className="text-xs text-gray-500 self-center">+{values.length - 14}</span>}
                </div>
                <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end gap-1">
                  <Button variant="ghost" size="iconSm" icon={Pencil} onClick={() => openEdit(t)} aria-label="Editar" />
                  <Button variant="dangerGhost" size="iconSm" icon={Trash2} onClick={() => handleDelete(t)} aria-label="Remover" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor (painel lateral) */}
      {form && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => !saving && setForm(null)} />
          <div className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col animate-fade-up [animation-duration:0.3s]">
            <div className="px-6 h-16 flex items-center justify-between border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">{form.id ? `Editar ${form.name || "variação"}` : "Nova variação"}</h2>
              <Button variant="ghost" size="icon" icon={X} onClick={() => setForm(null)} aria-label="Fechar" />
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome da variação</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("variation-value-input")?.focus(); } }}
                  placeholder="Ex.: Tamanho, Cor, Estampa"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                />
                {isColor && <p className="text-[11px] text-gray-500 mt-1">Variação de cor: a loja mostra uma bolinha com a cor de cada opção.</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Opções</label>
                <input
                  id="variation-value-input"
                  value={draft}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/[,;]/.test(v)) addValues(v);
                    else setDraft(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addValues(draft); }
                    else if (e.key === "Backspace" && !draft && form.values.length) setForm({ ...form, values: form.values.slice(0, -1) });
                  }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (/[,;\n]/.test(text)) { e.preventDefault(); addValues(text); }
                  }}
                  placeholder={isColor ? "Digite uma cor e tecle Enter (ex.: Marrom com azul)" : "Digite e tecle Enter ou vírgula (ex.: P, M, G)"}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                />
                <div className="mt-3 flex flex-wrap content-start items-start gap-1.5 min-h-8">
                  {form.values.length === 0 && <span className="text-xs text-gray-400 italic">Nenhuma opção ainda — você também pode ajustar no produto.</span>}
                  {form.values.map((v, i) => (
                    <span key={v} className="inline-flex items-center gap-0.5">
                      {form.values.length > 1 && (
                        <button type="button" onClick={() => moveValue(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-0 text-xs px-0.5" aria-label={`Mover ${v} para a esquerda`}>‹</button>
                      )}
                      <Chip value={v} color={isColor} onRemove={() => setForm({ ...form, values: form.values.filter((x) => x !== v) })} />
                      {form.values.length > 1 && (
                        <button type="button" onClick={() => moveValue(i, 1)} disabled={i === form.values.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-0 text-xs px-0.5" aria-label={`Mover ${v} para a direita`}>›</button>
                      )}
                    </span>
                  ))}
                </div>
                {form.values.length > 1 && <p className="text-[11px] text-gray-400 mt-2">Use ‹ › para mudar a ordem em que as opções aparecem na loja.</p>}
              </div>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Atalhos</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK.map((q) => (
                    <Button key={q.label} variant="secondary" size="xs" icon={Plus} onClick={() => applyQuick(q)} className="rounded-full font-medium">
                      {q.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-2">
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>Cancelar</Button>
                <Button variant="primary" icon={Check} onClick={save} loading={saving} loadingText="Salvando…" disabled={!form.name.trim()}>
                  {form.id ? "Salvar" : "Criar variação"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
