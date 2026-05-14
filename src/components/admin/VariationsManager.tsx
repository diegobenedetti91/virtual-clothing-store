"use client";

import { useState } from "react";
import { Plus, X, Pencil, Check, Trash2, Layers } from "lucide-react";

interface VariationTemplate {
  id: string;
  name: string;
  values: string;
  active: boolean;
}

interface Props {
  initialTemplates: VariationTemplate[];
}

export default function VariationsManager({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editValues, setEditValues] = useState<string[]>([]);
  const [editNewValue, setEditNewValue] = useState("");

  // New template form
  const [newName, setNewName] = useState("");
  const [newValues, setNewValues] = useState<string[]>([]);
  const [newValue, setNewValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputClass = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition";

  // ---- New template ----
  const addNewValue = () => {
    const v = newValue.trim();
    if (v && !newValues.includes(v)) { setNewValues((p) => [...p, v]); setNewValue(""); }
  };

  const handleCreate = async () => {
    if (!newName.trim()) { setError("Informe o nome da variação"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/admin/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), values: newValues }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Erro ao salvar"); return; }
      const created = await res.json();
      setTemplates((p) => [...p, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName(""); setNewValues([]); setCreating(false);
    } finally {
      setSaving(false);
    }
  };

  // ---- Edit template ----
  const startEdit = (t: VariationTemplate) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditValues(JSON.parse(t.values || "[]"));
    setEditNewValue("");
  };

  const addEditValue = () => {
    const v = editNewValue.trim();
    if (v && !editValues.includes(v)) { setEditValues((p) => [...p, v]); setEditNewValue(""); }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editingId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/variations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, name: editName.trim(), values: editValues }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setTemplates((p) =>
        p.map((t) => (t.id === editingId ? updated : t)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover a variação "${name}"? Produtos já criados não serão afetados.`)) return;
    await fetch(`/api/admin/variations?id=${id}`, { method: "DELETE" });
    setTemplates((p) => p.filter((t) => t.id !== id));
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

  return (
    <div className="max-w-2xl space-y-4">
      {/* Template list */}
      {templates.length === 0 && !creating && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Layers size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma variação cadastrada</p>
          <p className="text-xs text-gray-400 mt-1">Crie a primeira para agilizar o cadastro de produtos</p>
        </div>
      )}

      {templates.map((t) => {
        const values = JSON.parse(t.values || "[]") as string[];
        const isEditing = editingId === t.id;

        return (
          <div key={t.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isEditing ? "border-brand" : "border-gray-100"}`}>
            {isEditing ? (
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome da variação</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={inputClass}
                    placeholder="Ex: Sabor, Tamanho, Cor"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valores</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      value={editNewValue}
                      onChange={(e) => setEditNewValue(e.target.value)}
                      className={inputClass}
                      placeholder="Adicionar valor"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEditValue(); } }}
                    />
                    <button type="button" onClick={addEditValue} className="px-3 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {editValues.map((v) => (
                      <span key={v} className="flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                        {v}
                        <button type="button" onClick={() => setEditValues((p) => p.filter((x) => x !== v))} className="text-gray-400 hover:text-red-500">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    {editValues.length === 0 && <span className="text-xs text-gray-400 italic">Nenhum valor</span>}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleSaveEdit} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-60 transition-colors" style={{ backgroundColor: "var(--brand)" }}>
                    <Check size={15} /> Salvar
                  </button>
                  <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold text-sm ${t.active ? "text-gray-900" : "text-gray-400 line-through"}`}>{t.name}</p>
                    {!t.active && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">inativo</span>}
                  </div>
                  {values.length > 0 ? (
                    <div className="flex gap-1.5 flex-wrap mt-1.5">
                      {values.map((v) => (
                        <span key={v} className="bg-gray-50 border border-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{v}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mt-0.5 italic">Sem valores cadastrados</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleActive(t)}
                    className="p-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title={t.active ? "Desativar" : "Ativar"}
                  >
                    <div className={`w-8 h-4 rounded-full transition-colors relative ${t.active ? "" : "bg-gray-200"}`} style={t.active ? { backgroundColor: "var(--brand)" } : {}}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${t.active ? "translate-x-4 left-0.5" : "left-0.5"}`} />
                    </div>
                  </button>
                  <button onClick={() => startEdit(t)} className="p-2 text-gray-400 hover:text-brand hover:bg-gray-100 rounded-lg transition-colors" aria-label="Editar">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => handleDelete(t.id, t.name)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" aria-label="Remover">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Create new */}
      {creating ? (
        <div className="bg-white rounded-2xl border-2 border-brand shadow-sm p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 text-sm">Nova variação</h3>
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={inputClass}
              placeholder="Ex: Sabor, Tamanho, Cor, Recheio..."
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("new-value-input")?.focus(); } }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Valores</label>
            <div className="flex gap-2 mb-2">
              <input
                id="new-value-input"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className={inputClass}
                placeholder="Ex: Chocolate, Baunilha, Morango..."
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewValue(); } }}
              />
              <button type="button" onClick={addNewValue} className="px-3 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                <Plus size={16} />
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {newValues.map((v) => (
                <span key={v} className="flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                  {v}
                  <button type="button" onClick={() => setNewValues((p) => p.filter((x) => x !== v))} className="text-gray-400 hover:text-red-500">
                    <X size={12} />
                  </button>
                </span>
              ))}
              {newValues.length === 0 && <span className="text-xs text-gray-400 italic">Adicione valores acima — você poderá editar no produto</span>}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-60 transition-colors" style={{ backgroundColor: "var(--brand)" }}>
              <Check size={15} /> {saving ? "Salvando..." : "Criar variação"}
            </button>
            <button onClick={() => { setCreating(false); setNewName(""); setNewValues([]); setError(""); }} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-500 hover:border-brand hover:text-brand transition-colors"
        >
          <Plus size={16} /> Nova variação
        </button>
      )}
    </div>
  );
}
