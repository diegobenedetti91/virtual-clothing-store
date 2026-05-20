"use client";

import { useState, useEffect, useCallback } from "react";
import { PackagePlus, Pencil, Trash2, Check, X, Package } from "lucide-react";
import { PackagePreset } from "@/types";

const EMPTY = { name: "", comprimento: "", largura: "", altura: "", pesoGramas: "" };

export default function EmbalagensManager() {
  const [packages, setPackages] = useState<(PackagePreset & { _count?: { products: number } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputClass = "border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition w-full";

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/packages");
    setPackages(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name || !form.comprimento || !form.largura || !form.altura) {
      setError("Preencha nome e todas as dimensões.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = editId ? `/api/admin/packages/${editId}` : "/api/admin/packages";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          comprimento: parseInt(form.comprimento),
          largura: parseInt(form.largura),
          altura: parseInt(form.altura),
          pesoGramas: parseInt(form.pesoGramas) || 0,
        }),
      });
      if (!res.ok) throw new Error();
      setForm(EMPTY);
      setEditId(null);
      await load();
    } catch {
      setError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (pkg: PackagePreset) => {
    setEditId(pkg.id);
    setForm({
      name: pkg.name,
      comprimento: pkg.comprimento.toString(),
      largura: pkg.largura.toString(),
      altura: pkg.altura.toString(),
      pesoGramas: pkg.pesoGramas.toString(),
    });
    setError("");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover embalagem? Os produtos vinculados perderão o vínculo.")) return;
    await fetch(`/api/admin/packages/${id}`, { method: "DELETE" });
    await load();
  };

  const handleCancel = () => { setEditId(null); setForm(EMPTY); setError(""); };

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <PackagePlus size={18} className="text-brand" />
          {editId ? "Editar embalagem" : "Nova embalagem"}
        </h2>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Nome *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Ex: Caixa P 20x15x10" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Compr. (cm) *</label>
            <input type="number" min="1" value={form.comprimento} onChange={(e) => setForm({ ...form, comprimento: e.target.value })} className={inputClass} placeholder="20" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Largura (cm) *</label>
            <input type="number" min="1" value={form.largura} onChange={(e) => setForm({ ...form, largura: e.target.value })} className={inputClass} placeholder="15" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Altura (cm) *</label>
            <input type="number" min="1" value={form.altura} onChange={(e) => setForm({ ...form, altura: e.target.value })} className={inputClass} placeholder="10" />
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="w-48">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Peso da embalagem vazia (g)</label>
            <input type="number" min="0" value={form.pesoGramas} onChange={(e) => setForm({ ...form, pesoGramas: e.target.value })} className={inputClass} placeholder="200" />
          </div>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-brand text-white rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-60">
            <Check size={16} />
            {saving ? "Salvando..." : editId ? "Salvar alterações" : "Adicionar"}
          </button>
          {editId && (
            <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition">
              <X size={16} /> Cancelar
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : packages.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma embalagem cadastrada ainda.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {packages.map((pkg) => {
              const vol = pkg.comprimento * pkg.largura * pkg.altura;
              const count = pkg._count?.products ?? 0;
              return (
                <div key={pkg.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{pkg.name}</p>
                      {count > 0 && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                          {count} produto{count !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {pkg.comprimento} × {pkg.largura} × {pkg.altura} cm &nbsp;·&nbsp;
                      Vol: {(vol / 1000).toFixed(1)} L &nbsp;·&nbsp;
                      Tara: {pkg.pesoGramas}g
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(pkg)} className="p-2 text-gray-400 hover:text-brand hover:bg-brand/5 rounded-lg transition">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(pkg.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
