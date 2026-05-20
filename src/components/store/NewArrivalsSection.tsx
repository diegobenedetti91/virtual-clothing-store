"use client";

import { useState, useMemo } from "react";
import ProductCard from "@/components/store/ProductCard";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Product } from "@/types";

interface Props {
  products: Product[];
}

export default function NewArrivalsSection({ products }: Props) {
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const p of products) {
      if (p.category && !seen.has(p.category.id)) {
        seen.add(p.category.id);
        result.push({ id: p.category.id, name: p.category.name });
      }
    }
    return result;
  }, [products]);

  const filtered = selectedCat ? products.filter((p) => p.category?.id === selectedCat) : products;

  if (!products.length) return null;

  const showPills = categories.length > 1;

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Recém chegadas
            </span>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Novidades</h2>
          </div>
          <Link
            href="/produtos"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-brand transition-colors"
          >
            Ver todas <ArrowRight size={14} />
          </Link>
        </div>

        {/* Category filter pills — sticky on mobile while inside this section */}
        {showPills && (
          <div className="sticky top-0 z-20 -mx-4 sm:mx-0 px-4 sm:px-0 bg-gray-50/95 backdrop-blur-sm sm:static sm:bg-transparent py-3 sm:py-0 mb-6 border-b border-gray-200/60 sm:border-0">
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0 sm:flex-wrap">
              <button
                onClick={() => setSelectedCat(null)}
                className={`shrink-0 h-8 px-4 rounded-full text-xs font-bold transition-all border ${
                  !selectedCat
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
                  className={`shrink-0 h-8 px-4 rounded-full text-xs font-bold transition-all border ${
                    selectedCat === cat.id
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-8">
          {filtered.slice(0, 8).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        <div className="mt-10 text-center sm:hidden">
          <Link
            href="/produtos"
            className="inline-flex items-center gap-2 bg-gray-900 text-white font-bold px-8 py-3.5 rounded-2xl hover:bg-gray-800 transition-colors text-sm"
          >
            Ver todos os produtos <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
