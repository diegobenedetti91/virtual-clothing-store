"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Category } from "@/types";
import ImageUpload from "./ImageUpload";

interface Props {
  initialCategories: Category[];
}

export default function CategoryManager({ initialCategories }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", image: "" });
  const [editForm, setEditForm] = useState({ name: "", image: "" });
  const [loading, setLoading] = useState(false);

  const inputClass = "border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition";

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, image: form.image }),
    });
    const cat = await res.json();
    setCategories([...categories, cat]);
    setForm({ name: "", image: "" });
    setAdding(false);
    setLoading(false);
    router.refresh();
  };

  const handleEdit = async (id: string) => {
    setLoading(true);
    const res = await fetch(`/api/categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editForm.name, image: editForm.image }),
    });
    const cat = await res.json();
    setCategories(categories.map((c) => (c.id === id ? cat : c)));
    setEditing(null);
    setLoading(false);
    router.refresh();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir categoria "${name}"? Isso pode afetar os produtos associados.`)) return;
    setLoading(true);
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    setCategories(categories.filter((c) => c.id !== id));
    setLoading(false);
    router.refresh();
  };

  const startEdit = (cat: Category) => {
    setEditing(cat.id);
    setEditForm({ name: cat.name, image: cat.image || "" });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Categorias ({categories.length})</h2>
          <button
            onClick={() => { setAdding(true); setForm({ name: "", image: "" }); }}
            className="flex items-center gap-1.5 bg-brand text-white px-3 py-1.5 rounded-xl text-sm font-medium hover:opacity-90 transition-colors"
          >
            <Plus size={14} /> Nova
          </button>
        </div>

        {adding && (
          <div className="bg-brand-light border border-pink-100 rounded-xl p-4 mb-4 space-y-3">
            <p className="text-sm font-medium text-pink-800">Nova categoria</p>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={`${inputClass} w-full`}
              placeholder="Nome da categoria"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <ImageUpload value={form.image} onChange={(url) => setForm({ ...form, image: url })} label="Imagem (opcional)" aspect="square" />
            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={loading} className="flex items-center gap-1 bg-brand text-white px-3 py-1.5 rounded-xl text-sm hover:opacity-90 transition-colors disabled:opacity-60">
                <Check size={14} /> Salvar
              </button>
              <button onClick={() => setAdding(false)} className="flex items-center gap-1 text-gray-600 px-3 py-1.5 rounded-xl text-sm border border-gray-200 hover:border-gray-300 transition-colors">
                <X size={14} /> Cancelar
              </button>
            </div>
          </div>
        )}

        {categories.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Nenhuma categoria criada.</p>
        ) : (
          <ul className="space-y-2">
            {categories.map((cat) => (
              <li key={cat.id} className="border border-gray-100 rounded-xl overflow-hidden">
                {editing === cat.id ? (
                  <div className="p-3 space-y-2">
                    <input
                      autoFocus
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className={`${inputClass} w-full`}
                      onKeyDown={(e) => e.key === "Enter" && handleEdit(cat.id)}
                    />
                    <ImageUpload value={editForm.image} onChange={(url) => setEditForm({ ...editForm, image: url })} label="Imagem" aspect="square" />
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(cat.id)} disabled={loading} className="flex items-center gap-1 bg-brand text-white px-3 py-1.5 rounded-lg text-sm hover:opacity-90 transition-colors disabled:opacity-60">
                        <Check size={13} /> Salvar
                      </button>
                      <button onClick={() => setEditing(null)} className="flex items-center gap-1 text-gray-600 px-3 py-1.5 rounded-lg text-sm border border-gray-200 hover:border-gray-300 transition-colors">
                        <X size={13} /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      {cat.image ? (
                        <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">👗</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{cat.name}</p>
                      <p className="text-xs text-gray-500">{cat._count?.products || 0} produto{(cat._count?.products || 0) !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(cat)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(cat.id, cat.name)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Dicas</h2>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-brand font-bold mt-0.5">•</span>
            <span>Crie categorias como "Vestidos", "Blusas", "Calças", "Acessórios"</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand font-bold mt-0.5">•</span>
            <span>Adicione uma URL de imagem para deixar a categoria mais visual na loja</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand font-bold mt-0.5">•</span>
            <span>Cada categoria aparece como um carrossel separado na página inicial</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand font-bold mt-0.5">•</span>
            <span>Ao excluir uma categoria, os produtos associados ficam sem categoria</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
