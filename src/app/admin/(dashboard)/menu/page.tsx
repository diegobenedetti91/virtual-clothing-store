"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff, GripVertical, Lock } from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  href: string;
  active: boolean;
  position: number;
  _count?: { products: number };
}

const FIXED = [
  { label: "Início", href: "/", locked: true },
  { label: "Produtos", href: "/produtos", locked: true },
];

export default function AdminMenuPage() {
  const [items, setItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/nav-items").then((r) => r.json()).then((d) => { setItems(d); setLoading(false); });
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!label.trim()) { setError("Informe o nome do link"); return; }
    setAdding(true);
    try {
      const res = await fetch("/api/nav-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), href: href.trim() }),
      });
      const item = await res.json();
      setItems((prev) => [...prev, item]);
      setLabel("");
      setHref("/");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este item do menu?")) return;
    await fetch(`/api/nav-items/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleFixHref = async (item: NavItem) => {
    const autoHref = `/produtos?menu=${item.id}`;
    const res = await fetch(`/api/nav-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ href: autoHref }),
    });
    const updated = await res.json();
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, href: updated.href } : i)));
  };

  const handleToggle = async (item: NavItem) => {
    const res = await fetch(`/api/nav-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    const updated = await res.json();
    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
  };

  const inputClass = "border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition bg-white";

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Menu da loja</h1>
        <p className="text-gray-500 text-sm mt-1">
          Adicione links personalizados no cabeçalho da loja. Início e Produtos são fixos.
        </p>
      </div>

      {/* Fixed items */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Itens fixos</p>
        </div>
        <div className="divide-y divide-gray-100">
          {FIXED.map((item) => (
            <div key={item.href} className="flex items-center gap-3 px-5 py-3.5">
              <Lock size={14} className="text-gray-300 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-700">{item.label}</p>
                <p className="text-xs text-gray-400">{item.href}</p>
              </div>
              <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">Fixo</span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom items */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Itens personalizados</p>
          <span className="text-xs text-gray-400">{items.length} item{items.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <div className="w-5 h-5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">
            Nenhum item adicionado ainda.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => (
              <div key={item.id} className={`flex items-center gap-3 px-5 py-3.5 ${!item.active ? "opacity-50" : ""}`}>
                <GripVertical size={14} className="text-gray-300 shrink-0 cursor-grab" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                    {(item._count?.products ?? 0) > 0 && (
                      <span className="text-[10px] bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-semibold">
                        {item._count!.products} produto{item._count!.products !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{item.href}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(item._count?.products ?? 0) > 0 && item.href !== `/produtos?menu=${item.id}` && (
                    <button
                      onClick={() => handleFixHref(item)}
                      className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-colors"
                      title="Link não filtra os produtos deste menu. Clique para corrigir."
                    >
                      Corrigir link
                    </button>
                  )}
                  <button
                    onClick={() => handleToggle(item)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    title={item.active ? "Ocultar" : "Mostrar"}
                  >
                    {item.active ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Plus size={16} className="text-pink-500" /> Adicionar item
        </h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nome do link</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={`${inputClass} w-full`}
                placeholder="Ex: Promoção"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Destino (URL) <span className="text-gray-400 font-normal">— opcional</span>
              </label>
              <input
                value={href}
                onChange={(e) => setHref(e.target.value)}
                className={`${inputClass} w-full`}
                placeholder="Deixe vazio para filtrar produtos automaticamente"
              />
              <p className="text-[11px] text-gray-400 mt-1">Se vazio, filtra produtos marcados com este menu no cadastro.</p>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2">
            <p className="text-xs text-gray-400 w-full">Sugestões de nome:</p>
            {["Promoção 🔥", "Black Friday", "Novidades ✨", "Lançamentos"].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => { setLabel(name); setHref(""); }}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-pink-300 hover:text-pink-600 transition-colors"
              >
                {name}
              </button>
            ))}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={adding}
            className="w-full py-2.5 bg-pink-600 text-white text-sm font-bold rounded-xl hover:bg-pink-700 transition-colors disabled:opacity-60"
          >
            {adding ? "Adicionando..." : "Adicionar ao menu"}
          </button>
        </form>
      </div>
    </div>
  );
}
