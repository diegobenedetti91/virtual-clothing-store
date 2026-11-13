"use client";

import { useEffect, useState } from "react";
import { Box, Info, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { PackagePreset } from "@/types";
import { KpiCard } from "@/components/admin/charts/Charts";

type Pkg = PackagePreset & { active?: boolean; _count?: { products: number } };

interface FormState {
  id?: string;
  name: string;
  comprimento: string;
  largura: string;
  altura: string;
  pesoGramas: string;
  active: boolean;
}

const EMPTY: FormState = { name: "", comprimento: "", largura: "", altura: "", pesoGramas: "", active: true };
const PRESETS = [
  { name: "Envelope", comprimento: 30, largura: 25, altura: 3, pesoGramas: 30 },
  { name: "Caixa P", comprimento: 20, largura: 15, altura: 10, pesoGramas: 150 },
  { name: "Caixa M", comprimento: 30, largura: 20, altura: 15, pesoGramas: 250 },
  { name: "Caixa G", comprimento: 40, largura: 30, altura: 20, pesoGramas: 400 },
];

const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white";
const labelCls = "block text-xs font-medium text-gray-600 mb-1";

/** Desenho isométrico simples da caixa, proporcional às medidas. */
function BoxDrawing({ c, l, a, size = 72 }: { c: number; l: number; a: number; size?: number }) {
  const max = Math.max(c, l, a, 1);
  const w = (c / max) * size * 0.62;
  const d = (l / max) * size * 0.32;
  const h = (a / max) * size * 0.5;
  const ox = (size - w - d) / 2;
  const oy = (size - h - d * 0.6) / 2 + d * 0.6;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {/* topo */}
      <path d={`M${ox},${oy} l${d},${-d * 0.6} h${w} l${-d},${d * 0.6} Z`} fill="#e7d3b0" stroke="#a8875a" strokeWidth="1" />
      {/* frente */}
      <rect x={ox} y={oy} width={w} height={Math.max(h, 2)} fill="#d6b88a" stroke="#a8875a" strokeWidth="1" />
      {/* lateral */}
      <path d={`M${ox + w},${oy} l${d},${-d * 0.6} v${Math.max(h, 2)} l${-d},${d * 0.6} Z`} fill="#c4a272" stroke="#a8875a" strokeWidth="1" />
      {/* fita */}
      <path d={`M${ox + w / 2},${oy} l${d},${-d * 0.6}`} stroke="#8a6a3e" strokeWidth="1.5" />
    </svg>
  );
}

export default function EmbalagensManager() {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/packages")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setPackages(Array.isArray(d) ? d : []);
        setLoaded(true);
      })
      .catch(() => !cancelled && setLoaded(true));
    return () => { cancelled = true; };
  }, [reload]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const openNew = () => { setError(""); setForm({ ...EMPTY }); };
  const openEdit = (p: Pkg) => {
    setError("");
    setForm({
      id: p.id,
      name: p.name,
      comprimento: String(p.comprimento),
      largura: String(p.largura),
      altura: String(p.altura),
      pesoGramas: String(p.pesoGramas ?? 0),
      active: p.active !== false,
    });
  };

  const save = async () => {
    if (!form) return;
    const dims = [form.comprimento, form.largura, form.altura].map((v) => parseInt(v));
    if (!form.name.trim()) return setError("Dê um nome para a embalagem.");
    if (dims.some((n) => !Number.isFinite(n) || n <= 0)) return setError("Comprimento, largura e altura precisam ser maiores que zero.");
    const peso = form.pesoGramas ? parseInt(form.pesoGramas) : 0;
    if (!Number.isFinite(peso) || peso < 0) return setError("O peso da embalagem não pode ser negativo.");
    setSaving(true);
    setError("");
    try {
      const res = await fetch(form.id ? `/api/admin/packages/${form.id}` : "/api/admin/packages", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          comprimento: dims[0],
          largura: dims[1],
          altura: dims[2],
          pesoGramas: peso,
          // O PUT grava "ativa" quando o campo falta; enviamos sempre para editar não reativar
          active: form.active,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Erro ao salvar. Tente novamente.");
      }
      setForm(null);
      setReload((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Pkg) => {
    const count = p._count?.products ?? 0;
    const msg = count
      ? `Remover "${p.name}"? ${count} produto(s) usam esta embalagem e vão voltar a usar as medidas padrão do frete.`
      : `Remover "${p.name}"?`;
    if (!confirm(msg)) return;
    await fetch(`/api/admin/packages/${p.id}`, { method: "DELETE" });
    setReload((n) => n + 1);
  };

  const toggleActive = async (p: Pkg) => {
    setPackages((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: p.active === false } : x)));
    await fetch(`/api/admin/packages/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: p.name, comprimento: p.comprimento, largura: p.largura, altura: p.altura, pesoGramas: p.pesoGramas, active: p.active === false }),
    });
  };

  const visible = packages.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const activeCount = packages.filter((p) => p.active !== false).length;
  const linked = packages.reduce((s, p) => s + (p._count?.products ?? 0), 0);
  const fc = parseInt(form?.comprimento || "0") || 0;
  const fl = parseInt(form?.largura || "0") || 0;
  const fa = parseInt(form?.altura || "0") || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Embalagens</h1>
          <p className="text-sm text-gray-500 mt-1">Caixas e envelopes que você usa. Servem para sugerir a embalagem de cada pedido e calcular peso e volume do envio.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 active:scale-[0.98] transition shrink-0">
          <Plus size={16} /> Nova embalagem
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard icon={Box} label="Embalagens" value={String(packages.length)} current={packages.length} />
        <KpiCard icon={Box} label="Em uso nas sugestões" value={String(activeCount)} current={activeCount} hint="Embalagens ativas entram na sugestão de empacotamento" />
        <KpiCard icon={Box} label="Produtos vinculados" value={String(linked)} current={linked} />
      </div>

      {packages.length > 3 && (
        <label className="relative block max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar embalagem…" className="w-full pl-8 pr-3 py-2 text-[13px] rounded-xl border border-gray-200 bg-white" />
        </label>
      )}

      {!loaded ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="img-skeleton rounded-2xl h-36" />)}</div>
      ) : packages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-14 text-center px-4">
          <Box size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">Nenhuma embalagem cadastrada</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">Comece pelas que você mais usa, ex.: envelope 30×25×3 cm e caixa 30×20×15 cm.</p>
          <button onClick={openNew} className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-semibold"><Plus size={15} /> Cadastrar embalagem</button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const vol = (p.comprimento * p.largura * p.altura) / 1000;
            const count = p._count?.products ?? 0;
            const off = p.active === false;
            return (
              <div key={p.id} className={`group bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-md transition p-4 flex gap-4 ${off ? "opacity-70" : ""}`}>
                <div className="w-[72px] h-[72px] rounded-xl bg-amber-50/60 flex items-center justify-center shrink-0">
                  <BoxDrawing c={p.comprimento} l={p.largura} a={p.altura} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!off}
                      onClick={() => toggleActive(p)}
                      title={off ? "Fora das sugestões — clique para ativar" : "Usada nas sugestões — clique para desativar"}
                      className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${off ? "bg-gray-300" : "bg-brand"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${off ? "" : "translate-x-4"}`} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 tabular-nums">{p.comprimento} × {p.largura} × {p.altura} cm</p>
                  <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                    <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 tabular-nums">{vol.toFixed(1)} L</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 tabular-nums">tara {p.pesoGramas} g</span>
                    {count > 0 && <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700">{count} produto{count !== 1 ? "s" : ""}</span>}
                    {off && <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">inativa</span>}
                  </div>
                  <div className="mt-2 flex justify-end gap-0.5">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Editar"><Pencil size={15} /></button>
                    <button onClick={() => remove(p)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Excluir"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            );
          })}
          {visible.length === 0 && <p className="text-sm text-gray-500 col-span-full text-center py-8">Nenhuma embalagem com esse nome.</p>}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => !saving && setForm(null)} />
          <div className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col animate-fade-up [animation-duration:0.3s]">
            <div className="px-6 h-16 flex items-center justify-between border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">{form.id ? "Editar embalagem" : "Nova embalagem"}</h2>
              <button onClick={() => setForm(null)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100" aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {!form.id && (
                <div>
                  <p className={labelCls}>Começar de um modelo</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => setForm((f) => (f ? { ...f, name: p.name, comprimento: String(p.comprimento), largura: String(p.largura), altura: String(p.altura), pesoGramas: String(p.pesoGramas) } : f))}
                        className="text-xs px-2.5 py-1.5 rounded-full ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        {p.name} · {p.comprimento}×{p.largura}×{p.altura}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className={labelCls}>Nome</label>
                <input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Caixa M" className={inputCls} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {([["comprimento", "Comprimento"], ["largura", "Largura"], ["altura", "Altura"]] as const).map(([k, l]) => (
                  <div key={k}>
                    <label className={labelCls}>{l} (cm)</label>
                    <input inputMode="numeric" value={form[k]} onChange={(e) => set(k, e.target.value.replace(/\D/g, ""))} placeholder="0" className={inputCls} />
                  </div>
                ))}
              </div>
              <div>
                <label className={labelCls}>Peso da embalagem vazia (g)</label>
                <input inputMode="numeric" value={form.pesoGramas} onChange={(e) => set("pesoGramas", e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 200" className={inputCls} />
              </div>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.active}
                  onClick={() => set("active", !form.active)}
                  className={`mt-0.5 relative w-9 h-5 rounded-full shrink-0 transition-colors ${form.active ? "bg-brand" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.active ? "translate-x-4" : ""}`} />
                </button>
                <span>
                  <span className="block text-sm font-medium text-gray-900">Usar nas sugestões de empacotamento</span>
                  <span className="block text-xs text-gray-500">Desligada, continua vinculada aos produtos, mas não é sugerida na tela de Envios.</span>
                </span>
              </label>

              {/* Prévia */}
              <div className="rounded-2xl bg-gray-50 p-4 flex items-center gap-4">
                <div className="w-[88px] h-[88px] rounded-xl bg-white flex items-center justify-center shrink-0">
                  {fc && fl && fa ? <BoxDrawing c={fc} l={fl} a={fa} size={84} /> : <Box size={28} className="text-gray-300" />}
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-gray-900">{form.name || "Sua embalagem"}</p>
                  <p className="text-gray-600 tabular-nums">{fc || "–"} × {fl || "–"} × {fa || "–"} cm</p>
                  {fc && fl && fa ? <p className="text-xs text-gray-500 mt-0.5 tabular-nums">Volume {((fc * fl * fa) / 1000).toFixed(1)} L · cabe ~{((fc * fl * fa * 0.75) / 1000).toFixed(1)} L de roupa</p> : null}
                </div>
              </div>
              <div className="flex gap-2.5 rounded-xl bg-blue-50 px-3.5 py-3 text-xs text-blue-900">
                <Info size={15} className="shrink-0 mt-0.5" />
                <p>As transportadoras cobram pelo maior entre o peso real e o peso cúbico (C × L × A ÷ 6.000). Caixas grandes demais encarecem o frete, então cadastre medidas reais e prefira a menor caixa que serve.</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-2">
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setForm(null)} disabled={saving} className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100">Cancelar</button>
                <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white shadow-sm hover:opacity-90 disabled:opacity-50">
                  {saving ? "Salvando…" : form.id ? "Salvar alterações" : "Cadastrar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
