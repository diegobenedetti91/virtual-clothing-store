"use client";

import { useState } from "react";
import { ShoppingBag, Check, Heart } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { formatCurrency } from "@/lib/utils";

interface Props {
  productId: string;
  name: string;
  price: number;
  comparePrice?: number | null;
  image: string;
  slug: string;
  sizes: string[];
  colors: string[];
}

export default function ProductActions({ productId, name, price, comparePrice, image, slug, sizes, colors }: Props) {
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [added, setAdded] = useState(false);
  const addItem = useCart((s) => s.addItem);
  const { toggle, has } = useWishlist();
  const inWishlist = has(productId);

  const discount =
    comparePrice && comparePrice > price
      ? Math.round(((comparePrice - price) / comparePrice) * 100)
      : 0;

  const handleAddToCart = () => {
    addItem({
      productId,
      name,
      price,
      image,
      size: selectedSize || undefined,
      color: selectedColor || undefined,
      quantity: 1,
      slug,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleWishlist = () => {
    toggle({ productId, name, price, image, slug });
  };

  return (
    <div className="space-y-5">
      {/* Price */}
      <div className="flex items-end gap-3">
        <span className="text-4xl font-black text-gray-900 tracking-tight">{formatCurrency(price)}</span>
        {discount > 0 && comparePrice && (
          <>
            <span className="text-xl text-gray-400 line-through mb-1">{formatCurrency(comparePrice)}</span>
            <span className="mb-1 bg-red-100 text-red-600 text-sm font-bold px-2.5 py-1 rounded-full">
              -{discount}%
            </span>
          </>
        )}
      </div>

      {/* Sizes */}
      {sizes.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Tamanho
            {selectedSize && <span className="text-pink-600 normal-case tracking-normal ml-1">— {selectedSize}</span>}
          </p>
          <div className="flex gap-2 flex-wrap">
            {sizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size === selectedSize ? "" : size)}
                className={`min-w-[52px] h-11 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                  selectedSize === size
                    ? "border-gray-900 bg-gray-900 text-white shadow-md"
                    : "border-gray-200 text-gray-700 hover:border-gray-400"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Colors */}
      {colors.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Cor
            {selectedColor && <span className="text-pink-600 normal-case tracking-normal ml-1">— {selectedColor}</span>}
          </p>
          <div className="flex gap-2 flex-wrap">
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color === selectedColor ? "" : color)}
                className={`h-11 px-5 rounded-xl border-2 text-sm font-bold transition-all ${
                  selectedColor === color
                    ? "border-gray-900 bg-gray-900 text-white shadow-md"
                    : "border-gray-200 text-gray-700 hover:border-gray-400"
                }`}
              >
                {color}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CTA buttons */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={handleAddToCart}
          className={`flex-1 h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-lg active:scale-[0.98] ${
            added
              ? "bg-green-500 text-white shadow-green-100"
              : "bg-pink-600 text-white hover:bg-pink-700 shadow-pink-100"
          }`}
        >
          {added ? <Check size={20} /> : <ShoppingBag size={20} />}
          {added ? "Adicionado!" : "Adicionar ao carrinho"}
        </button>

        <button
          onClick={handleWishlist}
          className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all active:scale-[0.98] ${
            inWishlist
              ? "bg-pink-600 border-pink-600 text-white shadow-lg shadow-pink-100"
              : "border-gray-200 text-gray-400 hover:border-pink-400 hover:text-pink-500"
          }`}
          aria-label={inWishlist ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart size={20} fill={inWishlist ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  );
}
