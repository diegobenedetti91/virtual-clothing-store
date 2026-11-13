"use client";

import { useRef, useState } from "react";
import { ShoppingBag, Check, Heart, Minus, Plus, Loader2, Zap, Bell, AlertCircle } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { formatCurrency } from "@/lib/utils";
import { ProductAttribute } from "@/types";
import { NormalizedVariant, getStockForSelection, variantKey } from "@/lib/variantUtils";
import { isColorAttribute, swatchBackground } from "@/lib/colorSwatch";
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
  /** Desconto do Pix configurado na loja (0 = desligado) */
  pixPercent?: number;
}

export default function ProductActions({ productId, name, price, comparePrice, image, slug, attributes, stock, variantStock, pixPercent = 0 }: Props) {
  // Atributos com uma única opção (ex.: "Tamanho: Único") já vêm escolhidos
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(attributes.filter((a) => a.values.length === 1).map((a) => [a.name, a.values[0]]))
  );
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const addItem = useCart((s) => s.addItem);
  const cartItems = useCart((s) => s.items);
  const { toggle, has } = useWishlist();
  const inWishlist = has(productId);

  const discount = comparePrice && comparePrice > price ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;
  const pixPrice = pixPercent > 0 ? Math.round(price * (1 - pixPercent / 100) * 100) / 100 : null;

  const hasVariantStock = variantStock.length > 0;
  const totallyOut = stock <= 0;

  const currentVariantStock: number | null = (() => {
    if (!hasVariantStock) return null;
    if (!Object.values(selected).some(Boolean)) return null;
    return getStockForSelection(variantStock, selected);
  })();

  const effectiveStock = currentVariantStock !== null ? currentVariantStock : stock;
  const isOutOfStock = effectiveStock <= 0;
  const missing = attributes.filter((a) => !selected[a.name]);
  const fullySelected = missing.length === 0;
  const showWaitlist = isOutOfStock && fullySelected;

  const existingInCart = fullySelected
    ? cartItems.find((i) => i.productId === productId && variantKey(i.selectedAttributes || {}) === variantKey(selected))?.quantity ?? 0
    : 0;
  const maxQuantity = Math.max(0, effectiveStock - existingInCart);

  const selectValue = (attrName: string, val: string) => {
    setSelected((prev) => ({ ...prev, [attrName]: prev[attrName] === val ? "" : val }));
    setValidationError("");
    setHighlight(null);
    setQuantity(1);
  };

  const changeQty = (delta: number) => setQuantity((q) => Math.min(Math.max(1, maxQuantity), Math.max(1, q + delta)));

  /** Opção indisponível considerando o que já foi escolhido nos outros atributos. */
  const isValueOutOfStock = (attrName: string, val: string): boolean => {
    if (totallyOut) return true;
    if (!hasVariantStock) return false;
    const others = Object.fromEntries(Object.entries(selected).filter(([k, v]) => k !== attrName && v));
    return getStockForSelection(variantStock, { ...others, [attrName]: val }) === 0;
  };

  const pointToMissing = () => {
    const first = missing[0];
    if (!first) return;
    setValidationError(`Escolha ${first.name.toLowerCase()} para continuar`);
    setHighlight(first.name);
    groupRefs.current[first.name]?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlight(null), 1200);
  };

  const handleAddToCart = async () => {
    if (adding) return;
    if (!fullySelected) return pointToMissing();
    if (isOutOfStock) return;
    setAdding(true);
    setValidationError("");
    try {
      const params = new URLSearchParams({ productId });
      if (Object.keys(selected).length > 0) params.set("attributes", JSON.stringify(selected));
      const res = await fetch(`/api/stock?${params}`);
      const { available } = await res.json();
      const availableForCart = Math.max(0, available - existingInCart);
      if (available === 0) {
        setValidationError("Esta opção acabou de esgotar");
        return;
      }
      if (quantity > availableForCart) {
        setValidationError(`Só temos mais ${availableForCart} unidade${availableForCart !== 1 ? "s" : ""} desta opção`);
        return;
      }
      addItem({
        productId,
        name,
        price,
        image,
        size: selected["Tamanho"] || selected["Size"] || undefined,
        color: selected["Cor"] || selected["Color"] || undefined,
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

  const ctaLabel = added
    ? "Adicionado ao carrinho!"
    : adding
      ? "Verificando…"
      : totallyOut
        ? "Esgotado"
        : !fullySelected
          ? `Escolha ${missing[0].name.toLowerCase()}`
          : isOutOfStock
            ? "Esgotado nesta opção"
            : "Adicionar ao carrinho";
  const ctaDisabled = adding || (fullySelected && isOutOfStock) || totallyOut;

  return (
    <div className="space-y-5">
      {/* Preço */}
      <div>
        <div className="flex items-baseline flex-wrap gap-x-2.5 gap-y-1">
          <span className="text-3xl font-semibold text-gray-900 tracking-tight tabular-nums">{formatCurrency(price)}</span>
          {discount > 0 && comparePrice && (
            <>
              <span className="text-base text-gray-400 line-through tabular-nums">{formatCurrency(comparePrice)}</span>
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">-{discount}%</span>
            </>
          )}
        </div>
        {pixPrice != null && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-gray-600">
            <Zap size={14} className="text-emerald-600" />
            <b className="text-emerald-700 tabular-nums">{formatCurrency(pixPrice)}</b> no Pix
            <span className="text-xs text-gray-400">({pixPercent}% de desconto)</span>
          </p>
        )}
      </div>

      {totallyOut && (
        <div className="flex items-start gap-2.5 rounded-xl bg-gray-50 ring-1 ring-gray-200 px-3.5 py-3 text-sm text-gray-700">
          <Bell size={16} className="text-gray-500 shrink-0 mt-0.5" />
          <span>
            <b className="text-gray-900">Produto esgotado no momento.</b>{" "}
            {attributes.length > 0 ? "Escolha as opções abaixo e avisamos por e-mail quando voltar." : "Deixe seu e-mail e avisamos quando voltar."}
          </span>
        </div>
      )}

      {/* Opções */}
      {attributes.map((attr) => {
        const colorAttr = isColorAttribute(attr.name);
        return (
          <div
            key={attr.name}
            ref={(el) => { groupRefs.current[attr.name] = el; }}
            className={`rounded-2xl transition-all duration-300 ${highlight === attr.name ? "ring-2 ring-[var(--brand)] ring-offset-4" : ""}`}
          >
            <p className="text-sm text-gray-500 mb-2.5">
              <span className="font-semibold text-gray-900">{attr.name}</span>
              {selected[attr.name] ? <>: <span className="text-gray-700">{selected[attr.name]}</span></> : attr.values.length > 1 && <span className="text-gray-400"> · escolha uma opção</span>}
            </p>
            <div className="flex gap-2 flex-wrap">
              {attr.values.map((val) => {
                const out = isValueOutOfStock(attr.name, val);
                const isSel = selected[attr.name] === val;
                const swatch = colorAttr ? swatchBackground(val) : null;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => selectValue(attr.name, val)}
                    aria-pressed={isSel}
                    title={out ? `${val} — esgotado` : val}
                    className={`relative inline-flex items-center gap-2 h-10 rounded-full border text-[13px] font-medium transition-all active:scale-[0.97] ${swatch ? "pl-1.5 pr-3.5" : "px-4"} ${
                      isSel
                        ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                        : out
                          ? "border-gray-200 text-gray-400 bg-gray-50 hover:border-gray-300"
                          : "border-gray-200 text-gray-800 bg-white hover:border-gray-900"
                    }`}
                  >
                    {swatch && (
                      <span
                        className={`w-7 h-7 rounded-full shrink-0 ring-1 ${isSel ? "ring-white/40" : "ring-black/10"} ${out ? "opacity-50" : ""}`}
                        style={{ background: swatch }}
                      />
                    )}
                    <span className={out && !isSel ? "line-through decoration-gray-300" : ""}>{val}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Situação do estoque da opção escolhida */}
      {fullySelected && !totallyOut && currentVariantStock !== null && currentVariantStock > 0 && currentVariantStock <= 3 && (
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          {currentVariantStock === 1 ? "Última unidade!" : `Últimas ${currentVariantStock} unidades`}
        </p>
      )}

      {validationError && (
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 animate-fade-up [animation-duration:0.25s]">
          <AlertCircle size={15} /> {validationError}
        </p>
      )}

      {/* Quantidade + comprar + favoritar */}
      <div className="flex items-stretch gap-2.5">
        {!isOutOfStock && !totallyOut && (
          <div className="flex items-center rounded-2xl border border-gray-200 bg-white h-12 shrink-0">
            <button type="button" onClick={() => changeQty(-1)} disabled={quantity <= 1} className="w-10 h-full flex items-center justify-center text-gray-600 disabled:opacity-30" aria-label="Diminuir quantidade">
              <Minus size={15} />
            </button>
            <span className="w-7 text-center text-sm font-semibold text-gray-900 tabular-nums" aria-live="polite">{quantity}</span>
            <button type="button" onClick={() => changeQty(1)} disabled={quantity >= maxQuantity} className="w-10 h-full flex items-center justify-center text-gray-600 disabled:opacity-30" aria-label="Aumentar quantidade">
              <Plus size={15} />
            </button>
          </div>
        )}
        <button
          onClick={handleAddToCart}
          disabled={ctaDisabled}
          className={`flex-1 h-12 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
            added
              ? "bg-emerald-500 text-white"
              : ctaDisabled
                ? "bg-gray-200 text-gray-500"
                : !fullySelected
                  ? "bg-gray-900 text-white hover:bg-gray-800"
                  : "text-white shadow-[0_8px_20px_-8px_color-mix(in_srgb,var(--brand)_60%,transparent)] hover:-translate-y-0.5"
          }`}
          style={!added && !ctaDisabled && fullySelected ? { backgroundColor: "var(--brand)" } : undefined}
        >
          {added ? <Check size={18} /> : adding ? <Loader2 size={18} className="animate-spin" /> : <ShoppingBag size={18} />}
          {ctaLabel === "Adicionar ao carrinho" ? <span>Adicionar<span className="hidden min-[400px]:inline"> ao carrinho</span></span> : ctaLabel}
        </button>
        <button
          onClick={() => toggle({ productId, name, price, image, slug })}
          className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all active:scale-90 shrink-0 ${
            inWishlist ? "text-white border-transparent" : "border-gray-200 text-gray-500 hover:text-[var(--brand)] hover:border-[var(--brand)]"
          }`}
          style={inWishlist ? { backgroundColor: "var(--brand)" } : undefined}
          aria-label={inWishlist ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart size={19} fill={inWishlist ? "currentColor" : "none"} />
        </button>
      </div>

      {existingInCart > 0 && !added && (
        <p className="text-xs text-gray-500">Você já tem {existingInCart} desta opção no carrinho.</p>
      )}

      {(showWaitlist || (totallyOut && attributes.length === 0)) && (
        <WaitlistForm productId={productId} selectedAttributes={selected} />
      )}
    </div>
  );
}
