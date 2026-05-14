"use client";

import { useState } from "react";
import { ShoppingBag, Check, Heart, Package, Minus, Plus, Loader2 } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { formatCurrency } from "@/lib/utils";
import { ProductAttribute } from "@/types";
import { NormalizedVariant, getStockForSelection, variantKey } from "@/lib/variantUtils";
import WaitlistForm from "@/components/store/WaitlistForm";

interface Props {
  productId: string;
  name: string;
  price: number;
  comparePrice?: number | null;
  image: string;
  slug: string;
  attributes: ProductAttribute[];
  stock: number;
  variantStock: NormalizedVariant[];
}

export default function ProductActions({ productId, name, price, comparePrice, image, slug, attributes, stock, variantStock }: Props) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [validationError, setValidationError] = useState("");
  const addItem = useCart((s) => s.addItem);
  const cartItems = useCart((s) => s.items);
  const { toggle, has } = useWishlist();
  const inWishlist = has(productId);

  const discount =
    comparePrice && comparePrice > price
      ? Math.round(((comparePrice - price) / comparePrice) * 100)
      : 0;

  const hasVariantStock = variantStock.length > 0;

  // Compute current stock for the selected combination
  const currentVariantStock: number | null = (() => {
    if (!hasVariantStock) return null;
    const selectedKeys = Object.keys(selected).filter((k) => selected[k]);
    if (selectedKeys.length === 0) return null;
    return getStockForSelection(variantStock, selected);
  })();

  const effectiveStock = currentVariantStock !== null ? currentVariantStock : stock;
  const isOutOfStock = effectiveStock === 0;

  const fullySelected = attributes.every((a) => selected[a.name]);
  const showWaitlist = isOutOfStock && fullySelected;

  // Count same variant already in cart
  const existingInCart = fullySelected
    ? (cartItems.find(
        (i) =>
          i.productId === productId &&
          variantKey(i.selectedAttributes || {}) === variantKey(selected)
      )?.quantity ?? 0)
    : 0;

  const maxQuantity = Math.max(0, effectiveStock - existingInCart);

  const selectValue = (attrName: string, val: string) => {
    setSelected((prev) => ({
      ...prev,
      [attrName]: prev[attrName] === val ? "" : val,
    }));
    setValidationError("");
    setQuantity(1);
  };

  const changeQty = (delta: number) =>
    setQuantity((q) => Math.min(maxQuantity, Math.max(1, q + delta)));

  // Is a specific value out of stock given current partial selection?
  const isValueOutOfStock = (attrName: string, val: string): boolean => {
    if (!hasVariantStock) return false;
    const testSelection = { ...selected, [attrName]: val };
    return getStockForSelection(variantStock, testSelection) === 0;
  };

  const handleAddToCart = async () => {
    if (isOutOfStock || adding) return;
    for (const attr of attributes) {
      if (!selected[attr.name]) {
        setValidationError(`Selecione ${attr.name} antes de continuar`);
        return;
      }
    }
    setAdding(true);
    setValidationError("");
    try {
      const params = new URLSearchParams({ productId });
      if (Object.keys(selected).length > 0) {
        params.set("attributes", JSON.stringify(selected));
      }
      const res = await fetch(`/api/stock?${params}`);
      const { available } = await res.json();
      const availableForCart = Math.max(0, available - existingInCart);
      if (available === 0) {
        setValidationError("Produto esgotado no momento");
        return;
      }
      if (quantity > availableForCart) {
        setValidationError(
          `Estoque insuficiente — máximo ${availableForCart} unidade${availableForCart !== 1 ? "s" : ""} disponível${availableForCart !== 1 ? "is" : ""}`
        );
        return;
      }
      addItem({
        productId,
        name,
        price,
        image,
        selectedAttributes: Object.keys(selected).length > 0 ? selected : undefined,
        quantity,
        slug,
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } finally {
      setAdding(false);
    }
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

      {/* Attribute selectors */}
      {attributes.map((attr) => (
        <div key={attr.name}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            {attr.name}
            {selected[attr.name] && (
              <span className="normal-case tracking-normal ml-1" style={{ color: "var(--brand)" }}>
                — {selected[attr.name]}
              </span>
            )}
          </p>
          <div className="flex gap-2 flex-wrap">
            {attr.values.map((val) => {
              const outOfStock = isValueOutOfStock(attr.name, val);
              const isSelected = selected[attr.name] === val;
              return (
                <button
                  key={val}
                  onClick={() => selectValue(attr.name, val)}
                  className={`relative h-11 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                    isSelected
                      ? "border-gray-900 bg-gray-900 text-white shadow-md"
                      : outOfStock && fullySelected
                        ? "border-gray-100 text-gray-300"
                        : "border-gray-200 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  {val}
                  {outOfStock && fullySelected && !isSelected && (
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="absolute w-full h-px bg-gray-300 rotate-[-20deg]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

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

      {/* Quantity */}
      {!isOutOfStock && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Quantidade</p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => changeQty(-1)} disabled={quantity <= 1} className="w-9 h-9 rounded-xl border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <Minus size={14} />
            </button>
            <span className="w-8 text-center font-bold text-gray-900 text-lg">{quantity}</span>
            <button type="button" onClick={() => changeQty(1)} disabled={quantity >= maxQuantity} className="w-9 h-9 rounded-xl border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <Plus size={14} />
            </button>
            {existingInCart > 0 && (
              <span className="text-xs text-amber-600 font-medium">{existingInCart} já no carrinho</span>
            )}
          </div>
        </div>
      )}

      {validationError && (
        <p className="text-sm font-medium text-red-500">{validationError}</p>
      )}

      {/* CTA */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={handleAddToCart}
          disabled={isOutOfStock || adding}
          className={`flex-1 h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
            added ? "bg-green-500 text-white shadow-green-100" : "text-white shadow-[0_4px_14px_var(--brand-shadow)]"
          }`}
          style={!added ? { backgroundColor: "var(--brand)" } : undefined}
        >
          {added ? <Check size={20} /> : adding ? <Loader2 size={20} className="animate-spin" /> : <ShoppingBag size={20} />}
          {added ? "Adicionado!" : adding ? "Verificando..." : isOutOfStock ? "Sem estoque" : "Adicionar ao carrinho"}
        </button>

        <button
          onClick={() => toggle({ productId, name, price, image, slug })}
          className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all active:scale-[0.98] ${
            inWishlist ? "text-white shadow-lg" : "border-gray-200 text-gray-400 hover:text-[var(--brand)]"
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
          selectedAttributes={selected}
        />
      )}

      {/* Stock card */}
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
