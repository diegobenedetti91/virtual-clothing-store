"use client";

import Link from "next/link";
import { ShoppingBag, Heart, Check, Tag } from "lucide-react";

const COLOR_CSS: Record<string, string> = {
  azul: "#3b82f6", vermelho: "#ef4444", verde: "#22c55e", preto: "#18181b",
  branco: "#f4f4f5", rosa: "#ec4899", amarelo: "#eab308", laranja: "#f97316",
  roxo: "#8b5cf6", cinza: "#71717a", marrom: "#78350f", bege: "#d6bc96",
  caramelo: "#c08b5c", nude: "#e8c9a0", vinho: "#7f1d1d", navy: "#1e3a5f",
  coral: "#fb7185", salmão: "#fda4af", turquesa: "#2dd4bf", dourado: "#d97706",
  prata: "#9ca3af", off: "#fef3c7", lilás: "#c4b5fd", khaki: "#a3a062",
};

function colorToCss(name: string): string {
  const key = name.toLowerCase().trim();
  return COLOR_CSS[key] ?? COLOR_CSS[key.split(" ")[0]] ?? "#9ca3af";
}
import { Product } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useState } from "react";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const addItem = useCart((s) => s.addItem);
  const { toggle, has } = useWishlist();
  const [added, setAdded] = useState(false);

  const images = JSON.parse(product.images || "[]") as string[];
  const firstImage = images[0] || "/placeholder-product.svg";
  const secondImage = images[1];
  const inWishlist = has(product.id);
  const navItems = (product as unknown as { navItems?: { id: string; label: string }[] }).navItems || [];
  const variants = JSON.parse(product.variantStock || "[]") as unknown[];
  const hasVariants = variants.length > 0;
  const outOfStock = product.stock === 0;

  const isNew = new Date(product.createdAt).getTime() > Date.now() - 14 * 24 * 60 * 60 * 1000;

  const attrs = JSON.parse(product.attributes || "[]") as { name: string; values: string[] }[];
  const colorAttr = attrs.find((a) => ["cor", "color", "cores"].includes(a.name.toLowerCase()));
  const allColors = colorAttr?.values ?? [];
  const colorValues = allColors.slice(0, 5);
  const extraColors = allColors.length > 5 ? allColors.length - 5 : 0;

  const discount =
    product.comparePrice && product.comparePrice > product.price
      ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
      : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) return;
    if (hasVariants) {
      window.location.href = `/produtos/${product.slug}`;
      return;
    }
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: firstImage,
      quantity: 1,
      slug: product.slug,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: firstImage,
      slug: product.slug,
    });
  };

  return (
    <Link href={`/produtos/${product.slug}`} className="group block">
      {/* Image area */}
      <div className="relative bg-gray-100 rounded-2xl overflow-hidden aspect-[3/4]">
        <img
          src={firstImage}
          alt={product.name}
          className={`w-full h-full object-cover transition-all duration-500 ease-out ${secondImage ? "group-hover:opacity-0" : "group-hover:scale-[1.04]"}`}
          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; }}
        />
        {secondImage && (
          <img
            src={secondImage}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover opacity-0 scale-[1.04] group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 ease-out"
            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; }}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.featured && (
            <span className="bg-brand text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm tracking-wide uppercase">
              Destaque
            </span>
          )}
          {isNew && !product.featured && (
            <span className="bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm tracking-wide uppercase">
              Novo
            </span>
          )}
          {discount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
              -{discount}%
            </span>
          )}
        </div>

        {/* Wishlist button */}
        <button
          onClick={handleWishlist}
          className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm ${
            inWishlist
              ? "bg-brand text-white opacity-100"
              : "bg-white/90 backdrop-blur text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-brand-light hover:text-brand"
          }`}
          aria-label={inWishlist ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart size={14} fill={inWishlist ? "currentColor" : "none"} />
        </button>

        {/* Add to cart — slides up */}
        <div className="absolute inset-x-3 bottom-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-250 ease-out">
          <button
            onClick={handleAddToCart}
            disabled={outOfStock}
            className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-colors disabled:cursor-not-allowed ${
              outOfStock
                ? "bg-gray-200 text-gray-400"
                : added
                  ? "bg-green-500 text-white"
                  : "bg-white text-gray-900 hover:bg-brand hover:text-white"
            }`}
          >
            {added ? <Check size={14} /> : <ShoppingBag size={14} />}
            {outOfStock ? "Sem estoque" : added ? "Adicionado!" : hasVariants ? "Escolher opções" : "Adicionar ao carrinho"}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="mt-3 px-0.5">
        {product.category?.name && (
          <p className="text-[11px] font-semibold text-brand uppercase tracking-wider mb-1">
            {product.category.name}
          </p>
        )}
        <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-brand transition-colors">
          {product.name}
        </h3>
        {navItems.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {navItems.map((nav) => (
              <Link
                key={nav.id}
                href={`/produtos?menu=${nav.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100 hover:bg-fuchsia-100 transition-colors"
              >
                <Tag size={9} />
                {nav.label}
              </Link>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="font-black text-gray-900 text-base">{formatCurrency(product.price)}</span>
          {discount > 0 && (
            <span className="text-xs text-gray-400 line-through">{formatCurrency(product.comparePrice!)}</span>
          )}
        </div>
        {colorValues.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            {colorValues.map((c) => (
              <span
                key={c}
                title={c}
                className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0 inline-block"
                style={{ background: colorToCss(c) }}
              />
            ))}
            {extraColors > 0 && (
              <span className="text-[10px] text-gray-400 font-medium ml-0.5">+{extraColors}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
