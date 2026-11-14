"use client";

import { useEffect, useState } from "react";
import ProductRail from "@/components/store/ProductRail";
import type { Product } from "@/types";

/** "Combina com" no carrinho: sugestões a partir dos produtos que já estão nele. */
export default function CartSuggestions({ productIds, className }: { productIds: string[]; className?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  // Mudar a quantidade não refaz a busca; só adicionar/remover produtos
  const key = [...new Set(productIds)].sort().join(",");

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    fetch(`/api/products/related?ids=${key}&limit=10`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d) => setProducts(d.products || []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [key]);

  // Esconde o que já entrou no carrinho enquanto a lista não é atualizada
  const inCart = new Set(productIds);
  const visible = products.filter((p) => !inCart.has(p.id));
  if (!key || !visible.length) return null;
  return <ProductRail title="Combina com o seu carrinho" subtitle="Complete o look antes de finalizar" products={visible} className={className} />;
}
