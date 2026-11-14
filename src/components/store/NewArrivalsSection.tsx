import ProductCard from "@/components/store/ProductCard";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Product } from "@/types";

/** Novidades da home: as 8 peças mais recentes (as categorias já ficam logo acima, nos círculos). */
export default function NewArrivalsSection({ products }: { products: Product[] }) {
  if (!products.length) return null;
  return (
    <section className="py-14 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div data-reveal className="flex items-end justify-between mb-8">
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Recém-chegadas</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Novidades</h2>
          </div>
          <Link href="/produtos" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-brand transition-colors">
            Ver todas <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-8">
          {products.slice(0, 8).map((p, i) => (
            <div key={p.id} data-reveal style={{ "--reveal-delay": `${(i % 4) * 90}ms` } as React.CSSProperties}>
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
