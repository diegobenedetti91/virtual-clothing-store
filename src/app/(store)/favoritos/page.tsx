"use client";

import { useWishlist } from "@/hooks/useWishlist";
import { useCart } from "@/hooks/useCart";
import { formatCurrency } from "@/lib/utils";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";

export default function FavoritosPage() {
  const { items, toggle } = useWishlist();
  const addItem = useCart((s) => s.addItem);

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 rounded-3xl bg-pink-50 flex items-center justify-center mx-auto mb-6">
          <Heart size={32} className="text-pink-300" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sua lista de favoritos está vazia</h2>
        <p className="text-gray-400 mb-8">Clique no coração em qualquer produto para salvá-lo aqui.</p>
        <Link href="/produtos" className="inline-flex items-center gap-2 bg-brand text-white px-8 py-3.5 rounded-2xl font-bold hover:opacity-90 transition-colors">
          Ver produtos
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Heart size={24} className="text-pink-600" fill="currentColor" />
        <h1 className="text-3xl font-black text-gray-900">Favoritos</h1>
        <span className="bg-pink-100 text-pink-600 text-sm font-bold px-3 py-1 rounded-full">
          {items.length}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
        {items.map((item) => (
          <div key={item.productId} className="group relative">
            <Link href={`/produtos/${item.slug}`} className="block">
              <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 mb-3">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; }}
                />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-pink-600 transition-colors">
                {item.name}
              </h3>
              <p className="font-black text-gray-900 text-base mt-1">{formatCurrency(item.price)}</p>
            </Link>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => addItem({ ...item, quantity: 1 })}
                className="flex-1 flex items-center justify-center gap-1.5 bg-brand text-white py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-colors"
              >
                <ShoppingBag size={13} /> Adicionar
              </button>
              <button
                onClick={() => toggle(item)}
                className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
                aria-label="Remover dos favoritos"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
