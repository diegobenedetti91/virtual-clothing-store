"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, Check, Heart, ShoppingBag, Trash2, TrendingDown, Zap } from "lucide-react";
import { useWishlist } from "@/hooks/useWishlist";
import { useCart } from "@/hooks/useCart";
import { formatCurrency } from "@/lib/utils";

/** Situação atual do produto (preço com promoção, estoque, variações). */
interface Live {
  price: number;
  comparePrice: number | null;
  stock: number;
  hasVariants: boolean;
  active: boolean;
  flash: boolean;
}

export default function FavoritosPage() {
  const { items, toggle } = useWishlist();
  const addItem = useCart((s) => s.addItem);
  const [live, setLive] = useState<Record<string, Live | null>>({});
  const [added, setAdded] = useState<string | null>(null);
  const [removed, setRemoved] = useState<(typeof items)[number] | null>(null);

  // Busca preço/estoque atuais de cada favorito (a lista guarda só o que havia ao salvar)
  const ids = items.map((i) => i.productId).join(",");
  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    Promise.all(
      ids.split(",").map(async (id) => {
        try {
          const r = await fetch(`/api/products/${id}`);
          if (!r.ok) return [id, null] as const;
          const p = await r.json();
          let variants = 0;
          try { variants = (JSON.parse(p.variantStock || "[]") as unknown[]).length; } catch {}
          let attrs = 0;
          try { attrs = (JSON.parse(p.attributes || "[]") as { values: string[] }[]).filter((a) => a.values?.length > 1).length; } catch {}
          return [id, { price: p.price, comparePrice: p.comparePrice ?? null, stock: p.stock ?? 0, hasVariants: variants > 0 || attrs > 0, active: p.active !== false, flash: !!p.flashSale } as Live] as const;
        } catch {
          return [id, null] as const;
        }
      })
    ).then((entries) => !cancelled && setLive(Object.fromEntries(entries)));
    return () => { cancelled = true; };
  }, [ids]);

  const remove = (item: (typeof items)[number]) => {
    toggle(item);
    setRemoved(item);
    setTimeout(() => setRemoved((r) => (r?.productId === item.productId ? null : r)), 5000);
  };

  const quickAdd = (item: (typeof items)[number], price: number) => {
    addItem({ ...item, price, quantity: 1 });
    setAdded(item.productId);
    setTimeout(() => setAdded((a) => (a === item.productId ? null : a)), 1800);
  };

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <span className="absolute inset-0 rounded-full bg-brand-light animate-ping [animation-duration:2.5s] opacity-60" />
          <span className="relative w-24 h-24 rounded-full bg-brand-light flex items-center justify-center"><Heart size={36} className="text-brand" /></span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Nenhum favorito ainda</h1>
        <p className="text-gray-500 mt-2 mb-8">Toque no <Heart size={14} className="inline -mt-0.5 text-brand" /> de qualquer peça para guardar aqui e encontrar depois.</p>
        <Link href="/produtos" className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-gray-800">
          Explorar produtos <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  const cheaper = items.filter((i) => live[i.productId] && live[i.productId]!.price < i.price - 0.009).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2.5">
            <Heart size={26} className="text-brand" fill="currentColor" /> Favoritos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} {items.length === 1 ? "peça salva" : "peças salvas"}
            {cheaper > 0 && <> · <span className="text-emerald-700 font-medium">{cheaper} com preço menor que quando você salvou</span></>}
          </p>
        </div>
        <Link href="/produtos" className="text-sm font-medium text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">Continuar comprando <ArrowRight size={14} /></Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
        {items.map((item) => {
          const l = live[item.productId];
          const price = l?.price ?? item.price;
          const dropped = l && l.price < item.price - 0.009 ? item.price - l.price : 0;
          const out = l ? l.stock <= 0 : false;
          const unavailable = l === null || (l && !l.active);
          return (
            <div key={item.productId} className="group" data-reveal>
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 transition-all duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_-14px_rgba(0,0,0,0.28)]">
                <Link href={`/produtos/${item.slug}`} className="block w-full h-full">
                  <img
                    src={item.image}
                    alt={item.name}
                    className={`w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ${out || unavailable ? "grayscale-[60%] opacity-80" : ""}`}
                    onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.svg"; }}
                  />
                </Link>
                <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                  {l?.flash && <span className="bg-red-600/85 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase inline-flex items-center gap-1"><Zap size={10} fill="white" /> Flash</span>}
                  {dropped > 0 && <span className="bg-emerald-500/90 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1"><TrendingDown size={10} /> Baixou {formatCurrency(dropped)}</span>}
                  {out && !unavailable && <span className="bg-white/85 backdrop-blur-md text-gray-800 text-[10px] font-bold px-2.5 py-1 rounded-full">Esgotado</span>}
                  {unavailable && <span className="bg-white/85 backdrop-blur-md text-gray-800 text-[10px] font-bold px-2.5 py-1 rounded-full">Indisponível</span>}
                </div>
                <button
                  onClick={() => remove(item)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/85 backdrop-blur-md ring-1 ring-black/5 flex items-center justify-center text-brand hover:text-red-600 transition"
                  aria-label="Remover dos favoritos"
                  title="Remover dos favoritos"
                >
                  <Heart size={14} fill="currentColor" />
                </button>
              </div>

              <Link href={`/produtos/${item.slug}`} className="block mt-3 px-0.5">
                <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-brand transition-colors">{item.name}</h3>
                <p className="flex items-baseline gap-2 mt-1">
                  <span className="font-bold text-gray-900 tabular-nums">{formatCurrency(price)}</span>
                  {l?.comparePrice && l.comparePrice > price && <span className="text-xs text-gray-400 line-through tabular-nums">{formatCurrency(l.comparePrice)}</span>}
                </p>
              </Link>

              <div className="mt-3">
                {unavailable ? (
                  <button onClick={() => remove(item)} className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:bg-gray-50"><Trash2 size={14} /> Remover</button>
                ) : out ? (
                  <Link href={`/produtos/${item.slug}`} className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:bg-gray-50"><Bell size={14} /> Avise-me quando voltar</Link>
                ) : l?.hasVariants ? (
                  <Link href={`/produtos/${item.slug}`} className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-gray-800">Escolher tamanho e cor <ArrowRight size={14} /></Link>
                ) : (
                  <button
                    onClick={() => quickAdd(item, price)}
                    disabled={!l}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition ${added === item.productId ? "bg-emerald-500 text-white" : "bg-brand text-white hover:opacity-90"} disabled:opacity-50`}
                  >
                    {added === item.productId ? <><Check size={15} /> Adicionado</> : <><ShoppingBag size={15} /> Adicionar ao carrinho</>}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {removed && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] animate-fade-up [animation-duration:0.25s]">
          <div className="flex items-center gap-3 rounded-xl bg-gray-900 text-white text-sm px-4 py-2.5 shadow-xl">
            Removido dos favoritos
            <button onClick={() => { toggle(removed); setRemoved(null); }} className="font-semibold underline underline-offset-2">Desfazer</button>
          </div>
        </div>
      )}
    </div>
  );
}
