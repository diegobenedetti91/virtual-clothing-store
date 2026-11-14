"use client";

import { useCart } from "@/hooks/useCart";
import OptimizedImg from "@/components/OptimizedImg";
import CartSuggestions from "@/components/store/CartSuggestions";
import RecentlyViewed from "@/components/store/RecentlyViewed";
import { useCustomer } from "@/hooks/useCustomer";
import { formatCurrency } from "@/lib/utils";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, Lock, Tag, Truck, Zap, Heart, AlertCircle, ShieldCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { CartItem } from "@/types";
import { attributesLabel } from "@/lib/variantUtils";
import { PENDING_COUPON_KEY } from "@/components/store/CouponLinkCatcher";

const keyOf = (item: CartItem) =>
  `${item.productId}-${item.selectedAttributes ? JSON.stringify(item.selectedAttributes) : `${item.size ?? ""}-${item.color ?? ""}`}`;

function stockParams(item: CartItem) {
  const params = new URLSearchParams({ productId: item.productId });
  if (item.selectedAttributes && Object.keys(item.selectedAttributes).length > 0) {
    params.set("attributes", JSON.stringify(item.selectedAttributes));
  } else {
    if (item.size) params.set("size", item.size);
    if (item.color) params.set("color", item.color);
  }
  return params;
}

export default function CartPage() {
  const { items, removeItem, updateQuantity, total, addItem } = useCart();
  const customer = useCustomer((s) => s.customer);
  const customerLoading = useCustomer((s) => s.loading);
  const router = useRouter();
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [stockErrors, setStockErrors] = useState<Record<string, string>>({});
  const [pixPercent, setPixPercent] = useState(0);
  const [cashbackPct, setCashbackPct] = useState(0);
  const [pendingCoupon, setPendingCoupon] = useState<string | null>(null);
  const [removed, setRemoved] = useState<CartItem | null>(null);

  useEffect(() => {
    if (items.length === 0) return;
    Promise.all(
      items.map(async (item) => {
        const res = await fetch(`/api/stock?${stockParams(item)}`);
        const data = await res.json();
        return [keyOf(item), data.available ?? 0] as [string, number];
      })
    ).then((entries) => setStockMap(Object.fromEntries(entries)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // Desconto Pix e cupom vindo de link, para mostrar no resumo
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        setPixPercent(s?.pixDiscountEnabled ? s.pixDiscountPercent ?? 0 : 0);
        setCashbackPct(s?.cashbackEnabled ? s.cashbackPercent ?? 0 : 0);
      })
      .catch(() => {});
    try {
      const c = localStorage.getItem(PENDING_COUPON_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do localStorage após a hidratação
      if (c) setPendingCoupon(c);
    } catch {}
  }, []);

  async function handleIncrement(item: CartItem) {
    const key = keyOf(item);
    const res = await fetch(`/api/stock?${stockParams(item)}`);
    const { available } = await res.json();
    setStockMap((prev) => ({ ...prev, [key]: available }));
    if (item.quantity + 1 > available) {
      setStockErrors((prev) => ({
        ...prev,
        [key]: available === 0 ? "Produto esgotado" : `Só temos ${available} unidade${available !== 1 ? "s" : ""} desta opção`,
      }));
      return;
    }
    setStockErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
    updateQuantity(item.productId, item.quantity + 1, item.selectedAttributes, item.size, item.color);
  }

  function handleRemove(item: CartItem) {
    removeItem(item.productId, item.selectedAttributes, item.size, item.color);
    setRemoved(item);
    setTimeout(() => setRemoved((r) => (r && keyOf(r) === keyOf(item) ? null : r)), 5000);
  }

  const outOfStockItems = items.filter((i) => stockMap[keyOf(i)] === 0);
  const blocked = outOfStockItems.length > 0;

  function handleCheckout() {
    if (customerLoading || blocked) return;
    router.push(customer ? "/checkout" : "/conta/login?redirect=/checkout");
  }

  const units = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = total();
  const pixTotal = pixPercent > 0 ? subtotal * (1 - pixPercent / 100) : null;

  if (items.length === 0) {
    return (
      <>
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <span className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6"><ShoppingBag size={36} className="text-gray-400" /></span>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Seu carrinho está vazio</h1>
        <p className="text-gray-500 mt-2 mb-8">Que tal dar uma olhada nas novidades?</p>
        <div className="flex flex-wrap gap-2 justify-center">
          <Link href="/produtos" className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-gray-800">Ver produtos <ArrowRight size={16} /></Link>
          <Link href="/favoritos" className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-full text-sm font-semibold hover:bg-gray-200"><Heart size={15} /> Meus favoritos</Link>
        </div>
        </div>
        <RecentlyViewed className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 text-left" />
      </>
    );
  }

  return (
    <div className="bg-gray-50/70 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-32 lg:pb-10">
        <div className="flex items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Carrinho</h1>
            <p className="text-sm text-gray-500 mt-1">{units} {units === 1 ? "peça" : "peças"}</p>
          </div>
          <Link href="/produtos" className="text-sm font-medium text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">Continuar comprando <ArrowRight size={14} /></Link>
        </div>

        {blocked && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-red-50 ring-1 ring-red-200 px-4 py-3 text-sm text-red-800">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{outOfStockItems.length === 1 ? "Uma peça esgotou" : `${outOfStockItems.length} peças esgotaram`} enquanto estavam no carrinho. Remova para continuar.</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* Itens */}
          <ul className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] divide-y divide-gray-100">
            {items.map((item) => {
              const key = keyOf(item);
              const available = stockMap[key];
              const error = stockErrors[key];
              const out = available === 0;
              const variant = item.selectedAttributes && Object.keys(item.selectedAttributes).length > 0
                ? attributesLabel(item.selectedAttributes)
                : [item.size && `Tamanho: ${item.size}`, item.color && `Cor: ${item.color}`].filter(Boolean).join(" · ");
              return (
                <li key={key} className={`flex gap-4 p-4 sm:p-5 ${out ? "bg-red-50/40" : ""}`}>
                  <Link href={`/produtos/${item.slug}`} className="shrink-0">
                    <OptimizedImg
                      src={item.image}
                      widths={[160, 320]}
                      sizes="96px"
                      alt={item.name}
                      className={`w-20 h-24 sm:w-24 sm:h-28 object-cover rounded-xl bg-gray-100 ${out ? "grayscale opacity-70" : ""}`}
                    />
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/produtos/${item.slug}`} className="font-semibold text-gray-900 hover:text-brand transition-colors line-clamp-2">{item.name}</Link>
                        {variant && <p className="text-xs text-gray-500 mt-0.5">{variant}</p>}
                      </div>
                      <button onClick={() => handleRemove(item)} className="shrink-0 p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition" aria-label={`Remover ${item.name}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-auto pt-3 flex items-end justify-between gap-3">
                      <div className="inline-flex items-center rounded-full ring-1 ring-gray-200 bg-white h-9">
                        <button
                          onClick={() => {
                            setStockErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
                            if (item.quantity <= 1) handleRemove(item);
                            else updateQuantity(item.productId, item.quantity - 1, item.selectedAttributes, item.size, item.color);
                          }}
                          className="w-9 h-full flex items-center justify-center text-gray-600 hover:text-gray-900"
                          aria-label="Diminuir quantidade"
                        >
                          {item.quantity <= 1 ? <Trash2 size={13} /> : <Minus size={14} />}
                        </button>
                        <span className="w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">{item.quantity}</span>
                        <button
                          onClick={() => handleIncrement(item)}
                          disabled={available !== undefined && item.quantity >= available}
                          className="w-9 h-full flex items-center justify-center text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Aumentar quantidade"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 tabular-nums">{formatCurrency(item.price * item.quantity)}</p>
                        {item.quantity > 1 && <p className="text-xs text-gray-400 tabular-nums">{formatCurrency(item.price)} cada</p>}
                      </div>
                    </div>

                    {out ? (
                      <p className="text-xs text-red-600 font-medium mt-2">Esgotou — remova do carrinho para continuar</p>
                    ) : error ? (
                      <p className="text-xs text-red-600 font-medium mt-2">{error}</p>
                    ) : available !== undefined && available <= 3 ? (
                      <p className="text-xs text-amber-700 font-medium mt-2">{available === 1 ? "Última unidade!" : `Últimas ${available} unidades`}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Resumo */}
          <aside className="lg:sticky lg:top-28 space-y-3">
            <div className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
              <h2 className="text-[15px] font-semibold text-gray-900 mb-4">Resumo</h2>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between text-gray-600"><dt>Subtotal ({units} {units === 1 ? "peça" : "peças"})</dt><dd className="tabular-nums text-gray-900">{formatCurrency(subtotal)}</dd></div>
                <div className="flex justify-between text-gray-600"><dt className="inline-flex items-center gap-1.5"><Truck size={14} className="text-gray-400" /> Frete</dt><dd className="text-gray-500">calculado no checkout</dd></div>
                {pendingCoupon && (
                  <div className="flex justify-between text-emerald-700"><dt className="inline-flex items-center gap-1.5"><Tag size={14} /> Cupom {pendingCoupon}</dt><dd>aplicado no checkout</dd></div>
                )}
              </dl>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                {pixTotal != null && (
                  <p className="mt-1 text-right text-sm text-gray-600 inline-flex items-center gap-1 w-full justify-end">
                    <Zap size={13} className="text-emerald-600" /> ou <b className="text-emerald-700 tabular-nums">{formatCurrency(pixTotal)}</b> no Pix
                  </p>
                )}
                {cashbackPct > 0 && subtotal > 0 && (
                  <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[12.5px] text-violet-800">
                    <span aria-hidden>💜</span> Você ganha até <b className="tabular-nums">{formatCurrency(Math.round(subtotal * cashbackPct) / 100)}</b> de cashback nesta compra
                  </p>
                )}
              </div>
              <button
                onClick={handleCheckout}
                disabled={customerLoading || blocked}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-brand text-white py-3.5 rounded-xl font-semibold shadow-[0_10px_24px_-12px_color-mix(in_srgb,var(--brand)_70%,transparent)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <Lock size={16} /> {customer || customerLoading ? "Finalizar compra" : "Entrar e finalizar"}
              </button>
              {!customer && !customerLoading && <p className="mt-2 text-xs text-center text-gray-500">Você entra ou cria a conta e volta direto para o checkout.</p>}
            </div>
            <ul className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <li className="flex items-center gap-2 rounded-xl bg-white ring-1 ring-gray-200/70 px-3 py-2.5"><ShieldCheck size={15} className="text-emerald-600 shrink-0" /> Pagamento seguro</li>
              <li className="flex items-center gap-2 rounded-xl bg-white ring-1 ring-gray-200/70 px-3 py-2.5"><RefreshCw size={15} className="text-gray-500 shrink-0" /> 7 dias para devolver</li>
            </ul>
          </aside>
        </div>

        <CartSuggestions productIds={items.map((i) => i.productId)} className="mt-14" />
      </div>

      {/* Barra fixa no celular */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{formatCurrency(subtotal)}</p>
        </div>
        <button onClick={handleCheckout} disabled={customerLoading || blocked} className="ml-auto flex-1 max-w-[220px] inline-flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-xl font-semibold disabled:opacity-50">
          <Lock size={15} /> Finalizar
        </button>
      </div>

      {removed && (
        <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[70] animate-fade-up [animation-duration:0.25s]">
          <div className="flex items-center gap-3 rounded-xl bg-gray-900 text-white text-sm px-4 py-2.5 shadow-xl">
            Removido do carrinho
            <button onClick={() => { addItem(removed); setRemoved(null); }} className="font-semibold underline underline-offset-2">Desfazer</button>
          </div>
        </div>
      )}
    </div>
  );
}
