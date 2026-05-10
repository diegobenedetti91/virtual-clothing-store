"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Category, Product } from "@/types";
import ImageListInput from "./ImageListInput";

interface NavItemOption {
  id: string;
  label: string;
}

interface ProductFormProps {
  product?: Product;
  categories: Category[];
  navItems?: NavItemOption[];
}

export default function ProductForm({ product, categories, navItems = [] }: ProductFormProps) {
  const router = useRouter();
  const isEditing = !!product;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [price, setPrice] = useState(product?.price?.toString() || "");
  const [comparePrice, setComparePrice] = useState(product?.comparePrice?.toString() || "");
  const [categoryId, setCategoryId] = useState(product?.categoryId || "");
  const [stock, setStock] = useState(product?.stock?.toString() || "0");
  const [active, setActive] = useState(product?.active !== false);
  const [featured, setFeatured] = useState(product?.featured === true);
  const [images, setImages] = useState<string[]>(JSON.parse(product?.images || "[]"));
  const [sizes, setSizes] = useState<string[]>(JSON.parse(product?.sizes || "[]"));
  const [colors, setColors] = useState<string[]>(JSON.parse(product?.colors || "[]"));
  const [newImage, setNewImage] = useState("");
  const [newSize, setNewSize] = useState("");
  const [newColor, setNewColor] = useState("");
  const [selectedNavIds, setSelectedNavIds] = useState<string[]>(
    (product as unknown as { navItems?: { id: string }[] })?.navItems?.map((n) => n.id) || []
  );

  const toggleNav = (id: string) =>
    setSelectedNavIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const addToList = (
    val: string,
    list: string[],
    setList: (v: string[]) => void,
    setVal: (v: string) => void
  ) => {
    const trimmed = val.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      setVal("");
    }
  };

  const removeFromList = (val: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.filter((v) => v !== val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = isEditing ? `/api/products/${product!.id}` : "/api/products";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, price, comparePrice, categoryId, stock, active, featured, images, sizes, colors, navItemIds: selectedNavIds }),
      });

      if (!res.ok) throw new Error("Erro ao salvar produto");
      router.push("/admin/produtos");
      router.refresh();
    } catch {
      setError("Erro ao salvar produto. Verifique os dados e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/produtos" className="p-2 text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEditing ? "Editar produto" : "Novo produto"}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{isEditing ? product!.name : "Preencha os dados do produto"}</p>
        </div>
        <div className="ml-auto flex gap-3">
          <Link href="/admin/produtos" className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-pink-600 text-white text-sm font-medium rounded-xl hover:bg-pink-700 transition-colors disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Informações básicas</h2>
            <div>
              <label className={labelClass}>Nome do produto *</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Ex: Vestido Floral" />
            </div>
            <div>
              <label className={labelClass}>Descrição</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputClass} placeholder="Descreva o produto..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Preço *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input required type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={`${inputClass} pl-8`} placeholder="0,00" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Preço original (riscado)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input type="number" step="0.01" min="0" value={comparePrice} onChange={(e) => setComparePrice(e.target.value)} className={`${inputClass} pl-8`} placeholder="0,00" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Categoria *</label>
                <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
                  <option value="">Selecione...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Estoque</label>
                <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Imagens</h2>
            <ImageListInput images={images} onChange={setImages} aspect="portrait" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Variações</h2>
            <div>
              <label className={labelClass}>Tamanhos</label>
              <div className="flex gap-2 mb-2">
                <input value={newSize} onChange={(e) => setNewSize(e.target.value)} className={inputClass} placeholder="Ex: P, M, G, GG" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addToList(newSize, sizes, setSizes, setNewSize); } }} />
                <button type="button" onClick={() => addToList(newSize, sizes, setSizes, setNewSize)} className="px-3 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {sizes.map((s) => (
                  <span key={s} className="flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                    {s}
                    <button type="button" onClick={() => removeFromList(s, sizes, setSizes)} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Cores</label>
              <div className="flex gap-2 mb-2">
                <input value={newColor} onChange={(e) => setNewColor(e.target.value)} className={inputClass} placeholder="Ex: Preto, Branco, Rosa" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addToList(newColor, colors, setColors, setNewColor); } }} />
                <button type="button" onClick={() => addToList(newColor, colors, setColors, setNewColor)} className="px-3 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {colors.map((c) => (
                  <span key={c} className="flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                    {c}
                    <button type="button" onClick={() => removeFromList(c, colors, setColors)} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Publicação</h2>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-900">Ativo</p>
                <p className="text-xs text-gray-500">Visível na loja</p>
              </div>
              <div className={`relative w-11 h-6 rounded-full transition-colors ${active ? "bg-pink-600" : "bg-gray-200"}`} onClick={() => setActive(!active)}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${active ? "translate-x-5" : ""}`} />
              </div>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-900">Destaque</p>
                <p className="text-xs text-gray-500">Aparece na seção de destaque</p>
              </div>
              <div className={`relative w-11 h-6 rounded-full transition-colors ${featured ? "bg-pink-600" : "bg-gray-200"}`} onClick={() => setFeatured(!featured)}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${featured ? "translate-x-5" : ""}`} />
              </div>
            </label>
          </div>

          {navItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
              <div>
                <h2 className="font-semibold text-gray-900">Menu da loja</h2>
                <p className="text-xs text-gray-400 mt-0.5">Selecione em quais menus este produto aparece</p>
              </div>
              <div className="space-y-2">
                {navItems.map((item) => {
                  const checked = selectedNavIds.includes(item.id);
                  return (
                    <label key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${checked ? "border-pink-500 bg-pink-50" : "border-gray-100 hover:border-gray-200"}`}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-pink-600 border-pink-600" : "border-2 border-gray-300"}`}>
                        {checked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleNav(item.id)} />
                      <span className={`text-sm font-medium ${checked ? "text-pink-700" : "text-gray-700"}`}>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {images[0] && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Preview</h2>
              <img src={images[0]} alt="Preview" className="w-full aspect-[3/4] object-cover rounded-xl bg-gray-100" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; }} />
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
