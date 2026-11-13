"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ChevronRight, Eye, EyeOff, ExternalLink, Layers, MoreHorizontal, Package, Pencil, Search, Star, Trash2, X, Zap,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  slug?: string;
  description: string | null;
  price: number;
  comparePrice?: number | null;
  stock: number;
  active: boolean;
  featured: boolean;
  images: string;
  variantStock?: string | null;
  category: {
    id?: string;
    name: string;
  };
  createdAt: Date;
}

interface ProductsTableProps {
  products: Product[];
  /** Produtos com promoção relâmpago no ar agora */
  flashSaleProductIds?: string[];
}

const LOW_STOCK = 3;

type Tab = "all" | "active" | "inactive" | "out" | "low" | "featured";

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

function variantCount(raw?: string | null) {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v.length : 0;
  } catch {
    return 0;
  }
}

export default function ProductsTable({ products, flashSaleProductIds = [] }: ProductsTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  const flashSet = useMemo(() => new Set(flashSaleProductIds), [flashSaleProductIds]);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category?.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [products]
  );

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter((p) => p.active).length,
    out: products.filter((p) => p.active && p.stock <= 0).length,
    low: products.filter((p) => p.active && p.stock > 0 && p.stock <= LOW_STOCK).length,
  }), [products]);

  const inTab = (p: Product, t: Tab) => {
    switch (t) {
      case "active": return p.active;
      case "inactive": return !p.active;
      case "out": return p.stock <= 0;
      case "low": return p.stock > 0 && p.stock <= LOW_STOCK;
      case "featured": return p.featured;
      default: return true;
    }
  };

  // Busca e categoria valem para todas as abas (contadores incluídos)
  const base = useMemo(() => {
    const q = searchQuery.trim();
    return products.filter((p) => {
      if (categoryFilter && p.category?.name !== categoryFilter) return false;
      if (!q) return true;
      return matchesQuery(p.name, q) || matchesQuery(p.description || "", q);
    });
  }, [products, searchQuery, categoryFilter]);

  const filteredProducts = base.filter((p) => inTab(p, tab));

  const TABS: { key: Tab; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "active", label: "Ativos" },
    { key: "inactive", label: "Inativos" },
    { key: "out", label: "Sem estoque" },
    { key: "low", label: "Estoque baixo" },
    { key: "featured", label: "Destaques" },
  ];

  const remove = async (p: Product) => {
    setMenuFor(null);
    if (!confirm(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(p.id);
    await fetch(`/api/products/${p.id}`, { method: "DELETE" });
    router.refresh();
    setDeleting(null);
  };

  const hasFilters = searchQuery || categoryFilter;

  return (
    <div className="space-y-5">
      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Produtos", value: stats.total, icon: Package, tone: "", onClick: () => setTab("all") },
          { label: "Ativos na loja", value: stats.active, icon: Eye, tone: "", onClick: () => setTab("active") },
          { label: "Sem estoque", value: stats.out, icon: AlertTriangle, tone: stats.out ? "border-red-200" : "", onClick: () => setTab("out") },
          { label: `Estoque baixo (≤${LOW_STOCK})`, value: stats.low, icon: Layers, tone: stats.low ? "border-amber-200" : "", onClick: () => setTab("low") },
        ].map(({ label, value, icon: Icon, tone, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className={`text-left bg-white rounded-2xl border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-md hover:-translate-y-0.5 transition-all ${tone || "border-gray-200/70"}`}
          >
            <p className="text-[13px] text-gray-500 flex items-center gap-1.5"><Icon size={14} className="text-gray-400" />{label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{value}</p>
          </button>
        ))}
      </div>

      {/* Abas */}
      <div className="border-b border-gray-200 flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {TABS.map((t) => {
          const n = base.filter((p) => inTab(p, t.key)).length;
          const active = tab === t.key;
          const alert = (t.key === "out" || t.key === "low") && n > 0;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setLimit(50); }}
              className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${active ? "text-gray-900" : "text-gray-500 hover:text-gray-800"}`}
            >
              {t.label}
              <span className={`text-[11px] font-semibold rounded-full px-1.5 tabular-nums ${alert ? (t.key === "out" ? "bg-red-500 text-white" : "bg-amber-500 text-white") : "bg-gray-100 text-gray-600"}`}>{n}</span>
              <span className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gray-900 transition-transform ${active ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          );
        })}
      </div>

      {/* Busca e categoria */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou descrição"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-[13px] rounded-xl border border-gray-200 bg-white"
          />
        </label>
        {categories.length > 1 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="py-2 pl-3 pr-8 text-[13px] rounded-xl border border-gray-200 bg-white"
            aria-label="Filtrar por categoria"
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {hasFilters && (
          <button type="button" onClick={() => { setSearchQuery(""); setCategoryFilter(""); }} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 px-2 py-2">
            <X size={13} /> Limpar
          </button>
        )}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-14 text-center">
          <Package size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="font-medium text-gray-700">Nenhum produto encontrado</p>
          <p className="text-sm text-gray-500 mt-1">{searchQuery ? `Nada para "${searchQuery}" neste filtro.` : "Nenhum produto neste filtro."}</p>
        </div>
      ) : (
        // Sem overflow-hidden: o menu de ações precisa poder sair da borda da tabela
        <div className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="hidden md:grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_120px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-100 bg-gray-50/60 rounded-t-2xl">
            <span>Produto</span><span>Preço</span><span>Estoque</span><span>Status</span><span className="text-right">Ações</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {filteredProducts.slice(0, limit).map((product, rowIndex, arr) => {
              let firstImage: string | null = null;
              try { firstImage = (JSON.parse(product.images || "[]") as string[])[0] ?? null; } catch {}
              const variants = variantCount(product.variantStock);
              const onPromo = product.comparePrice != null && product.comparePrice > product.price;
              const inFlash = flashSet.has(product.id);
              const stockTone = product.stock <= 0 ? "text-red-600 bg-red-50" : product.stock <= LOW_STOCK ? "text-amber-700 bg-amber-50" : "text-emerald-700 bg-emerald-50";
              const openUp = arr.length > 2 && rowIndex >= arr.length - 2;
              return (
                <li
                  key={product.id}
                  onClick={() => router.push(`/admin/produtos/${product.id}`)}
                  className={`group grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_120px] gap-x-3 gap-y-2 items-center px-4 py-3 cursor-pointer hover:bg-gray-50/80 transition-colors ${deleting === product.id ? "opacity-50 pointer-events-none" : ""} ${!product.active ? "opacity-70" : ""}`}
                >
                  {/* Produto */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="relative w-12 h-14 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                      {firstImage ? (
                        <img src={firstImage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package size={18} className="absolute inset-0 m-auto text-gray-300" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate group-hover:text-brand">{product.name}</p>
                      <p className="text-xs text-gray-500 truncate">{product.category?.name}</p>
                    </div>
                  </div>

                  {/* Preço */}
                  <div className="hidden md:block">
                    <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(product.price)}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {onPromo && <span className="text-xs text-gray-400 line-through tabular-nums">{formatCurrency(product.comparePrice!)}</span>}
                      {inFlash && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-700 bg-red-50 rounded-full px-1.5 py-0.5"><Zap size={9} /> Relâmpago</span>}
                    </div>
                  </div>

                  {/* Estoque */}
                  <div className="hidden md:block">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${stockTone}`}>
                      {product.stock <= 0 ? "Sem estoque" : `${product.stock} un.`}
                    </span>
                    {variants > 0 && <p className="text-[11px] text-gray-400 mt-0.5">{variants} variaç{variants === 1 ? "ão" : "ões"}</p>}
                  </div>

                  {/* Status */}
                  <div className="hidden md:flex flex-wrap items-center gap-1">
                    {product.active ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5"><Eye size={11} /> Na loja</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5"><EyeOff size={11} /> Oculto</span>
                    )}
                    {product.featured && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5"><Star size={11} fill="currentColor" /> Destaque</span>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/admin/produtos/${product.id}`} className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100" aria-label="Editar" title="Editar">
                      <Pencil size={15} />
                    </Link>
                    <div className="relative">
                      <button type="button" onClick={() => setMenuFor(menuFor === product.id ? null : product.id)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Mais ações">
                        <MoreHorizontal size={16} />
                      </button>
                      {menuFor === product.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                          <div className={`absolute right-0 z-30 w-48 rounded-xl bg-white shadow-xl ring-1 ring-black/10 py-1 animate-fade-up [animation-duration:0.15s] ${openUp ? "bottom-full mb-1" : "top-full mt-1"}`}>
                            <Link href={`/admin/produtos/${product.id}`} className="flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50">
                              <Pencil size={14} /> Editar produto
                            </Link>
                            {product.slug && (
                              <a href={`/produtos/${product.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50">
                                <ExternalLink size={14} /> Ver na loja
                              </a>
                            )}
                            <button type="button" onClick={() => remove(product)} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 border-t border-gray-100">
                              <Trash2 size={14} /> Excluir
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <ChevronRight size={16} className="hidden md:block text-gray-300 group-hover:text-gray-500" />
                  </div>

                  {/* Celular: preço, estoque e status embaixo */}
                  <div className="md:hidden col-span-2 flex flex-wrap items-center gap-1.5 text-[11px] -mt-1 pl-15">
                    <span className="font-semibold text-gray-900 text-sm tabular-nums">{formatCurrency(product.price)}</span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${stockTone}`}>{product.stock <= 0 ? "Sem estoque" : `${product.stock} un.`}</span>
                    {!product.active && <span className="px-2 py-0.5 rounded-full font-semibold text-gray-500 bg-gray-100">Oculto</span>}
                    {product.featured && <span className="px-2 py-0.5 rounded-full font-semibold text-amber-700 bg-amber-50">Destaque</span>}
                    {inFlash && <span className="px-2 py-0.5 rounded-full font-semibold text-red-700 bg-red-50">Relâmpago</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          {filteredProducts.length > limit && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Mostrando {limit} de {filteredProducts.length}</span>
              <button type="button" onClick={() => setLimit((l) => l + 50)} className="font-medium text-gray-700 hover:text-gray-900">Ver mais</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
