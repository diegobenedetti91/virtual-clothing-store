"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "@/components/store/ProductCard";
import type { Product } from "@/types";

interface Props {
  title: string;
  subtitle?: string;
  products: Product[];
  action?: React.ReactNode;
  className?: string;
}

/** Faixa horizontal de produtos (arrasta no celular, setas no computador). */
export default function ProductRail({ title, subtitle, products, action, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  if (!products.length) return null;
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <section className={className}>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action}
          {products.length > 2 && (
            <div className="hidden sm:flex gap-1.5">
              <button type="button" onClick={() => scroll(-1)} aria-label="Anteriores" className="w-9 h-9 rounded-full ring-1 ring-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-900 hover:text-white hover:ring-gray-900 transition">
                <ChevronLeft size={18} />
              </button>
              <button type="button" onClick={() => scroll(1)} aria-label="Próximos" className="w-9 h-9 rounded-full ring-1 ring-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-900 hover:text-white hover:ring-gray-900 transition">
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <div key={p.id} className="snap-start shrink-0 w-[46%] sm:w-[31%] lg:w-[23%] xl:w-[19%]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
