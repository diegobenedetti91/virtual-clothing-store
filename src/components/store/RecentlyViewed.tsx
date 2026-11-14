"use client";

import { useEffect, useState } from "react";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { track } from "@/lib/analytics";
import ProductRail from "@/components/store/ProductRail";
import type { Product } from "@/types";

/**
 * Registra a visita ao produto (usar na página do produto): entra em "Vistos recentemente"
 * e conta no funil "Viram um produto" — venha o cliente da vitrine, da busca, do Instagram ou de um link direto.
 */
export function TrackProductView({ productId }: { productId: string }) {
  const add = useRecentlyViewed((s) => s.add);
  useEffect(() => {
    add(productId);
    track("PRODUCT_VIEW", { productId, path: window.location.pathname });
  }, [add, productId]);
  return null;
}

/** "Vistos recentemente": produtos abertos neste navegador, com preço e foto atualizados. */
export default function RecentlyViewed({ excludeId, className }: { excludeId?: string; className?: string }) {
  const ids = useRecentlyViewed((s) => s.ids);
  const clear = useRecentlyViewed((s) => s.clear);
  const [products, setProducts] = useState<Product[]>([]);
  // Na página do produto, o próprio produto acabou de entrar na lista: não mostrar
  const key = ids.filter((id) => id !== excludeId).slice(0, 12).join(",");

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    fetch(`/api/products/cards?ids=${key}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d) => setProducts(d.products || []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [key]);

  if (!key || products.length === 0) return null;
  return (
    <ProductRail
      title="Vistos recentemente"
      subtitle="Continue de onde parou"
      products={products}
      className={className}
      action={
        <button type="button" onClick={() => { clear(); setProducts([]); }} className="text-xs font-medium text-gray-400 hover:text-gray-700">
          Limpar
        </button>
      }
    />
  );
}
