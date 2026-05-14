"use client";

import { useCart } from "@/hooks/useCart";
import { useCustomer } from "@/hooks/useCustomer";
import { formatCurrency } from "@/lib/utils";
import { Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { CartItem } from "@/types";

export default function CartPage() {
  const { items, removeItem, updateQuantity, total } = useCart();
  const customer = useCustomer((s) => s.customer);
  const customerLoading = useCustomer((s) => s.loading);
  const router = useRouter();
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [stockErrors, setStockErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (items.length === 0) return;
    Promise.all(
      items.map(async (item) => {
        const key = `${item.productId}-${item.size ?? ""}-${item.color ?? ""}`;
        const params = new URLSearchParams({ productId: item.productId });
        if (item.size) params.set("size", item.size);
        if (item.color) params.set("color", item.color);
        const res = await fetch(`/api/stock?${params}`);
        const data = await res.json();
        return [key, data.available ?? 0] as [string, number];
      })
    ).then((entries) => setStockMap(Object.fromEntries(entries)));
  }, [items.length]);

  async function handleIncrement(item: CartItem) {
    const key = `${item.productId}-${item.size ?? ""}-${item.color ?? ""}`;
    const params = new URLSearchParams({ productId: item.productId });
    if (item.size) params.set("size", item.size);
    if (item.color) params.set("color", item.color);
    const res = await fetch(`/api/stock?${params}`);
    const { available } = await res.json();
    setStockMap((prev) => ({ ...prev, [key]: available }));
    if (item.quantity + 1 > available) {
      setStockErrors((prev) => ({
        ...prev,
        [key]: available === 0
          ? "Produto esgotado"
          : `Máximo disponível: ${available} unidade${available !== 1 ? "s" : ""}`,
      }));
      return;
    }
    setStockErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
    updateQuantity(item.productId, item.quantity + 1, item.size, item.color);
  }

  function handleCheckout() {
    if (customerLoading) return;
    if (!customer) {
      router.push("/conta/login?redirect=/checkout");
    } else {
      router.push("/checkout");
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <ShoppingBag size={64} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Carrinho vazio</h2>
        <p className="text-gray-500 mb-6">Adicione produtos para continuar.</p>
        <Link href="/produtos" className="bg-brand text-white px-8 py-3 rounded-full font-semibold hover:opacity-90 transition-colors">
          Ver produtos
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Carrinho</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div
              key={`${item.productId}-${item.size}-${item.color}`}
              className="flex gap-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm"
            >
              <Link href={`/produtos/${item.slug}`}>
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl bg-gray-100"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; }}
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/produtos/${item.slug}`} className="font-semibold text-gray-900 hover:text-brand transition-colors block truncate">
                  {item.name}
                </Link>
                <div className="flex gap-2 text-xs text-gray-500 mt-0.5">
                  {item.size && <span>Tam: {item.size}</span>}
                  {item.color && <span>Cor: {item.color}</span>}
                </div>
                <p className="font-bold text-gray-900 mt-1">{formatCurrency(item.price)}</p>
                {(() => {
                  const key = `${item.productId}-${item.size ?? ""}-${item.color ?? ""}`;
                  const available = stockMap[key];
                  const error = stockErrors[key];
                  return (
                    <>
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => {
                            setStockErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
                            updateQuantity(item.productId, item.quantity - 1, item.size, item.color);
                          }}
                          className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:border-brand transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => handleIncrement(item)}
                          disabled={available !== undefined && item.quantity >= available}
                          className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:border-brand transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus size={12} />
                        </button>
                        {available !== undefined && available <= 3 && available > 0 && (
                          <span className="text-xs text-amber-600 font-medium">
                            {available} disponíve{available !== 1 ? "is" : "l"}
                          </span>
                        )}
                        <button
                          onClick={() => removeItem(item.productId, item.size, item.color)}
                          className="ml-auto text-gray-400 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      {error && (
                        <p className="text-xs text-red-500 font-medium mt-1">{error}</p>
                      )}
                      {available === 0 && (
                        <p className="text-xs text-red-500 font-medium mt-1">Produto esgotado — remova do carrinho</p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm sticky top-24">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Resumo do pedido</h2>
            <div className="space-y-2 mb-4">
              {items.map((item) => (
                <div key={`${item.productId}-${item.size}-${item.color}`} className="flex justify-between text-sm text-gray-600">
                  <span className="truncate mr-2">{item.name} × {item.quantity}</span>
                  <span className="shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-4 mb-6">
              <div className="flex justify-between font-bold text-gray-900 text-lg">
                <span>Total</span>
                <span>{formatCurrency(total())}</span>
              </div>
            </div>
            <button
              onClick={handleCheckout}
              disabled={customerLoading}
              className="block w-full bg-brand text-white text-center py-3 rounded-xl font-semibold hover:opacity-90 transition-colors disabled:opacity-60"
            >
              Finalizar pedido
            </button>
            <Link href="/produtos" className="block text-center text-sm text-gray-500 hover:text-gray-700 mt-3 transition-colors">
              Continuar comprando
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
