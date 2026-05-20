"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { Category, PackagePreset, Product, ProductAttribute } from "@/types";
import { NormalizedVariant, generateCombinations, getProductAttributes, normalizeVariantStock } from "@/lib/variantUtils";
import ImageListInput from "./ImageListInput";

interface NavItemOption {
  id: string;
  label: string;
}

interface VariationTemplate {
  id: string;
  name: string;
  values: string;
  active: boolean;
}

interface ProductFormProps {
  product?: Product;
  categories: Category[];
  navItems?: NavItemOption[];
  variationTemplates?: VariationTemplate[];
  packages?: PackagePreset[];
}

export default function ProductForm({ product, categories, navItems = [], variationTemplates = [], packages = [] }: ProductFormProps) {
  const router = useRouter();
  const isEditing = !!product;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [price, setPrice] = useState(product?.price?.toString() || "");
  const [comparePrice, setComparePrice] = useState(product?.comparePrice?.toString() || "");
  const [costPrice, setCostPrice] = useState(product?.costPrice?.toString() || "");
  const [pesoGramas, setPesoGramas] = useState(product?.pesoGramas?.toString() || "");
  const [embalagemId, setEmbalagemId] = useState(product?.embalagemId || "");
  const [categoryId, setCategoryId] = useState(product?.categoryId || "");
  const [stock, setStock] = useState(product?.stock?.toString() || "0");
  const [active, setActive] = useState(product?.active !== false);
  const [featured, setFeatured] = useState(product?.featured === true);
  const [images, setImages] = useState<string[]>(JSON.parse(product?.images || "[]"));
  const [selectedNavIds, setSelectedNavIds] = useState<string[]>(
    (product as unknown as { navItems?: { id: string }[] })?.navItems?.map((n) => n.id) || []
  );

  // Attributes: array of {name, values}
  const [attributes, setAttributes] = useState<ProductAttribute[]>(() =>
    product ? getProductAttributes({
      attributes: product.attributes || "[]",
      sizes: product.sizes || "[]",
      colors: product.colors || "[]",
    }) : []
  );

  // Variant stock: normalized flat list of combinations
  const [variantStock, setVariantStock] = useState<NormalizedVariant[]>(() => {
    if (!product) return [];
    const raw = JSON.parse(product.variantStock || "[]");
    return normalizeVariantStock(raw);
  });

  const [newAttrValues, setNewAttrValues] = useState<Record<number, string>>({});
  const [collapsedAttrs, setCollapsedAttrs] = useState<Record<number, boolean>>({});

  // Auto-sum stock from variants
  useEffect(() => {
    if (variantStock.length > 0) {
      const total = variantStock.reduce((sum, v) => sum + (v.stock || 0), 0);
      setStock(total.toString());
    }
  }, [variantStock]);

  // Re-generate variant stock when attributes change
  useEffect(() => {
    const combos = generateCombinations(attributes);
    if (combos.length === 0) {
      setVariantStock([]);
      return;
    }
    setVariantStock((prev) =>
      combos.map((combo) => {
        const existing = prev.find((v) =>
          Object.entries(combo).every(([k, val]) => v.attributes[k] === val)
        );
        return { attributes: combo, stock: existing?.stock ?? 0 };
      })
    );
  }, [attributes]);

  const getVariantStockValue = (combo: Record<string, string>) =>
    variantStock.find((v) =>
      Object.entries(combo).every(([k, val]) => v.attributes[k] === val)
    )?.stock ?? 0;

  const setVariantStockValue = (combo: Record<string, string>, value: number) =>
    setVariantStock((prev) =>
      prev.map((v) =>
        Object.entries(combo).every(([k, val]) => v.attributes[k] === val)
          ? { ...v, stock: value }
          : v
      )
    );

  // Apply a variation template as a new attribute (or merge values if name already exists)
  const applyTemplate = (tpl: VariationTemplate) => {
    const values = JSON.parse(tpl.values || "[]") as string[];
    setAttributes((prev) => {
      const existing = prev.find((a) => a.name === tpl.name);
      if (existing) {
        // Merge new values
        return prev.map((a) =>
          a.name === tpl.name
            ? { ...a, values: Array.from(new Set([...a.values, ...values])) }
            : a
        );
      }
      return [...prev, { name: tpl.name, values }];
    });
  };

  const removeAttribute = (idx: number) =>
    setAttributes((prev) => prev.filter((_, i) => i !== idx));

  const addAttrValue = (attrIdx: number) => {
    const val = (newAttrValues[attrIdx] || "").trim();
    if (!val) return;
    setAttributes((prev) =>
      prev.map((a, i) =>
        i === attrIdx && !a.values.includes(val)
          ? { ...a, values: [...a.values, val] }
          : a
      )
    );
    setNewAttrValues((prev) => ({ ...prev, [attrIdx]: "" }));
  };

  const removeAttrValue = (attrIdx: number, val: string) =>
    setAttributes((prev) =>
      prev.map((a, i) =>
        i === attrIdx ? { ...a, values: a.values.filter((v) => v !== val) } : a
      )
    );

  const toggleNav = (id: string) =>
    setSelectedNavIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

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
        body: JSON.stringify({
          name, description, price, comparePrice, costPrice, categoryId,
          stock, variantStock, active, featured, images, attributes,
          pesoGramas: pesoGramas ? parseInt(pesoGramas) : null,
          embalagemId: embalagemId || null,
          navItemIds: selectedNavIds,
        }),
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

  const inputClass = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  const combos = generateCombinations(attributes);

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
            className="px-6 py-2 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
            style={{ backgroundColor: "var(--brand)" }}
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
          {/* Basic info */}
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
                <label className={labelClass}>Valor de compra (custo)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input type="number" step="0.01" min="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className={`${inputClass} pl-8`} placeholder="0,00" />
                </div>
                <p className="text-xs text-gray-400 mt-1">Usado no relatório de margem de lucro</p>
              </div>
              <div>
                <label className={labelClass}>Peso (gramas)</label>
                <input
                  type="number"
                  min="1"
                  value={pesoGramas}
                  onChange={(e) => setPesoGramas(e.target.value)}
                  className={inputClass}
                  placeholder="Ex: 300"
                />
                <p className="text-xs text-gray-400 mt-1">Para cálculo de frete pelos Correios</p>
              </div>
            </div>
            {packages.length > 0 && (
              <div>
                <label className={labelClass}>Embalagem padrão</label>
                <select value={embalagemId} onChange={(e) => setEmbalagemId(e.target.value)} className={inputClass}>
                  <option value="">Nenhuma (usar padrão das configurações)</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — {pkg.comprimento}×{pkg.largura}×{pkg.altura} cm
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Dimensões usadas no cálculo de frete e sugestão de empacotamento</p>
              </div>
            )}
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
                <label className={labelClass}>
                  Estoque
                  {variantStock.length > 0 && <span className="ml-1 text-xs text-green-600 font-normal">(calculado pelas variações)</span>}
                </label>
                <input
                  type="number" min="0" value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  readOnly={variantStock.length > 0}
                  className={`${inputClass} ${variantStock.length > 0 ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
                />
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Imagens</h2>
            <ImageListInput images={images} onChange={setImages} aspect="portrait" />
          </div>

          {/* Attributes */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900">Variações</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Crie atributos livres — ex: Sabor, Tamanho, Cor, Recheio. Cada um com seus próprios valores.
              </p>
            </div>

            {/* Template quick-pick */}
            {variationTemplates.filter((t) => t.active).length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Aplicar variação cadastrada</p>
                <div className="flex gap-2 flex-wrap">
                  {variationTemplates.filter((t) => t.active).map((tpl) => {
                    const alreadyApplied = attributes.some((a) => a.name === tpl.name);
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all ${
                          alreadyApplied
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-gray-200 bg-white text-gray-700 hover:border-[var(--brand)] hover:text-[var(--brand)]"
                        }`}
                      >
                        {alreadyApplied ? (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 10 10"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        ) : (
                          <Plus size={12} />
                        )}
                        {tpl.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Existing attributes */}
            {attributes.map((attr, attrIdx) => (
              <div key={attrIdx} className="border border-gray-100 rounded-xl overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer select-none"
                  onClick={() => setCollapsedAttrs((prev) => ({ ...prev, [attrIdx]: !prev[attrIdx] }))}
                >
                  <div className="flex items-center gap-2">
                    {collapsedAttrs[attrIdx] ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronUp size={14} className="text-gray-400" />}
                    <span className="text-sm font-semibold text-gray-900">{attr.name}</span>
                    <span className="text-xs text-gray-400">{attr.values.length} valor{attr.values.length !== 1 ? "es" : ""}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeAttribute(attrIdx); }}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                    aria-label="Remover atributo"
                  >
                    <X size={15} />
                  </button>
                </div>

                {!collapsedAttrs[attrIdx] && (
                  <div className="p-4 space-y-3">
                    {/* Add value */}
                    <div className="flex gap-2">
                      <input
                        value={newAttrValues[attrIdx] || ""}
                        onChange={(e) => setNewAttrValues((prev) => ({ ...prev, [attrIdx]: e.target.value }))}
                        className={inputClass}
                        placeholder={`Ex: ${attrIdx === 0 ? "P, M, G" : "Chocolate, Baunilha"}`}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAttrValue(attrIdx); } }}
                      />
                      <button
                        type="button"
                        onClick={() => addAttrValue(attrIdx)}
                        className="px-3 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    {/* Value chips */}
                    <div className="flex gap-2 flex-wrap">
                      {attr.values.map((val) => (
                        <span key={val} className="flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                          {val}
                          <button type="button" onClick={() => removeAttrValue(attrIdx, val)} className="text-gray-400 hover:text-red-500">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      {attr.values.length === 0 && (
                        <span className="text-xs text-gray-400 italic">Nenhum valor ainda — adicione acima</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Variant stock */}
            {combos.length > 0 && (
              <div>
                <label className={labelClass}>Estoque por variação</label>
                <p className="text-xs text-gray-400 mb-3">
                  Defina a quantidade disponível para cada combinação.
                </p>
                <div className="space-y-2">
                  {combos.map((combo, i) => {
                    const label = Object.entries(combo).map(([k, v]) => `${k}: ${v}`).join(" · ");
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="flex-1 text-sm text-gray-700 truncate">{label}</span>
                        <input
                          type="number"
                          min="0"
                          value={getVariantStockValue(combo)}
                          onChange={(e) => setVariantStockValue(combo, parseInt(e.target.value) || 0)}
                          className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition"
                        />
                        <span className="text-xs text-gray-400 shrink-0">un.</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Publish */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Publicação</h2>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-900">Ativo</p>
                <p className="text-xs text-gray-500">Visível na loja</p>
              </div>
              <div className={`relative w-11 h-6 rounded-full transition-colors ${active ? "" : "bg-gray-200"}`} style={active ? { backgroundColor: "var(--brand)" } : {}} onClick={() => setActive(!active)}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${active ? "translate-x-5" : ""}`} />
              </div>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-900">Destaque</p>
                <p className="text-xs text-gray-500">Aparece na seção de destaque</p>
              </div>
              <div className={`relative w-11 h-6 rounded-full transition-colors ${featured ? "" : "bg-gray-200"}`} style={featured ? { backgroundColor: "var(--brand)" } : {}} onClick={() => setFeatured(!featured)}>
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
                    <label key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${checked ? "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_8%,white)]" : "border-gray-100 hover:border-gray-200"}`}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${checked ? "" : "border-2 border-gray-300"}`} style={checked ? { backgroundColor: "var(--brand)", borderColor: "var(--brand)" } : {}}>
                        {checked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleNav(item.id)} />
                      <span className={`text-sm font-medium ${checked ? "text-[var(--brand)]" : "text-gray-700"}`}>{item.label}</span>
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
