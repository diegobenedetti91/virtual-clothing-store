"use client";

import { useState } from "react";
import { ShoppingBag, Check, Heart, Package } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { formatCurrency } from "@/lib/utils";
import { VariantStock } from "@/types";
import WaitlistForm from "@/components/store/WaitlistForm";

interface Props {
  productId: string;
  name: string;
  price: number;
  comparePrice?: number | null;
  image: string;
  slug: string;
  sizes: string[];
  colors: string[];
  stock: number;
  variantStock: VariantStock[];
}

export default function ProductActions({ productId, name, price, comparePrice, image, slug, sizes, colors, stock, variantStock }: Props) {
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

  const hasVariantStock = variantStock.length > 0;

  const currentVariantStock = (() => {
    if (!hasVariantStock) return null;
    if (sizes.length > 0 && colors.length > 0) {
      if (!selectedSize && !selectedColor) return null;
      // Both selected → exact combination
      if (selectedSize && selectedColor) {
        return variantStock.find((v) => v.size === selectedSize && v.color === selectedColor)?.stock ?? 0;
      }
      // Only size selected → sum across all colors for that size
      if (selectedSize) {
        return variantStock.filter((v) => v.size === selectedSize).reduce((s, v) => s + (v.stock || 0), 0);
      }
      // Only color selected → sum across all sizes for that color
      return variantStock.filter((v) => v.color === selectedColor).reduce((s, v) => s + (v.stock || 0), 0);
    }
    if (sizes.length > 0) {
      if (!selectedSize) return null;
      return variantStock.find((v) => v.size === selectedSize)?.stock ?? 0;
    }
    if (colors.length > 0) {
      if (!selectedColor) return null;
      return variantStock.find((v) => v.color === selectedColor)?.stock ?? 0;
    }
    return null;
  })();

  const effectiveStock = currentVariantStock !== null ? currentVariantStock : stock;
  const isOutOfStock = effectiveStock === 0;

  const variantFullySelected =
    (sizes.length === 0 || selectedSize !== "") &&
    (colors.length === 0 || selectedColor !== "");
  const showWaitlist = isOutOfStock && variantFullySelected;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
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
            {selectedSize && <span className="normal-case tracking-normal ml-1" style={{ color: "var(--brand)" }}>— {selectedSize}</span>}
          </p>
          <div className="flex gap-2 flex-wrap">
            {sizes.map((size) => {
              const varStock = hasVariantStock
                ? variantStock.find((v) => v.size === size && (colors.length === 0 || v.color === selectedColor))?.stock
                : undefined;
              const sizeOutOfStock = varStock === 0;
              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size === selectedSize ? "" : size)}
                  disabled={sizeOutOfStock && selectedColor !== ""}
                  className={`relative min-w-[52px] h-11 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                    selectedSize === size
                      ? "border-gray-900 bg-gray-900 text-white shadow-md"
                      : sizeOutOfStock && selectedColor
                        ? "border-gray-100 text-gray-300 cursor-not-allowed"
                        : "border-gray-200 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  {size}
                  {sizeOutOfStock && selectedColor && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="absolute w-full h-px bg-gray-300 rotate-[-25deg]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Colors */}
      {colors.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Cor
            {selectedColor && <span className="normal-case tracking-normal ml-1" style={{ color: "var(--brand)" }}>— {selectedColor}</span>}
          </p>
          <div className="flex gap-2 flex-wrap">
            {colors.map((color) => {
              const varStock = hasVariantStock
                ? variantStock.find((v) => v.color === color && (sizes.length === 0 || v.size === selectedSize))?.stock
                : undefined;
              const colorOutOfStock = varStock === 0;
              return (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color === selectedColor ? "" : color)}
                  disabled={colorOutOfStock && selectedSize !== ""}
                  className={`h-11 px-5 rounded-xl border-2 text-sm font-bold transition-all ${
                    selectedColor === color
                      ? "border-gray-900 bg-gray-900 text-white shadow-md"
                      : colorOutOfStock && selectedSize
                        ? "border-gray-100 text-gray-300 cursor-not-allowed line-through"
                        : "border-gray-200 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  {color}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Variant stock indicator */}
      {currentVariantStock !== null && (
        <p className={`text-sm font-medium ${isOutOfStock ? "text-red-500" : currentVariantStock <= 3 ? "text-amber-600" : "text-green-600"}`}>
          {isOutOfStock
            ? "Sem estoque para esta combinação"
            : currentVariantStock <= 3
              ? `Apenas ${currentVariantStock} unidade${currentVariantStock > 1 ? "s" : ""} disponíve${currentVariantStock > 1 ? "is" : "l"}`
              : `${currentVariantStock} unidades disponíveis`}
        </p>
      )}

      {/* CTA buttons */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          className={`flex-1 h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
            added ? "bg-green-500 text-white shadow-green-100" : "text-white shadow-[0_4px_14px_var(--brand-shadow)]"
          }`}
          style={!added ? { backgroundColor: "var(--brand)" } : undefined}
        >
          {added ? <Check size={20} /> : <ShoppingBag size={20} />}
          {added ? "Adicionado!" : isOutOfStock ? "Sem estoque" : "Adicionar ao carrinho"}
        </button>

        <button
          onClick={handleWishlist}
          className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all active:scale-[0.98] ${
            inWishlist
              ? "text-white shadow-lg"
              : "border-gray-200 text-gray-400 hover:text-[var(--brand)]"
          }`}
          style={inWishlist ? { backgroundColor: "var(--brand)", borderColor: "var(--brand)" } : {}}
          aria-label={inWishlist ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart size={20} fill={inWishlist ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Waitlist */}
      {showWaitlist && (
        <WaitlistForm
          productId={productId}
          size={selectedSize || undefined}
          color={selectedColor || undefined}
        />
      )}

      {/* Stock info card */}
      <div className="flex items-center gap-2.5 bg-gray-50 rounded-2xl px-4 py-3">
        <Package size={16} className={effectiveStock > 0 ? "text-green-500 shrink-0" : "text-red-400 shrink-0"} />
        <div>
          <p className="text-xs font-bold text-gray-700">Estoque</p>
          <p className="text-xs text-gray-500">
            {effectiveStock === 0
              ? "Indisponível"
              : effectiveStock > 5
                ? "Disponível"
                : `${effectiveStock} restante${effectiveStock > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>
    </div>
  );
}
