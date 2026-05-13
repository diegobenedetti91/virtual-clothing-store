"use client";

import { useEffect, useState } from "react";
import { Send, ShoppingBag } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface AbandonedCart {
  id: string; email: string; cartItems: string; createdAt: string; updatedAt: string;
}

export default function CarrinhosManager() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/abandoned-carts").then((r) => r.json()).then((d) => { setCarts(d); setLoading(false); });
  };
  useEffect(load, []);

  const handleSend = async (id: string) => {
    setSending(id);
    try {
      await fetch("/api/admin/abandoned-carts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      setCarts((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert("Erro ao enviar e-mail.");
    } finally {
      setSending(null);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      {carts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
          <ShoppingBag size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">Nenhum carrinho abandonado no momento.</p>
          <p className="text-gray-400 text-xs mt-1">Os carrinhos aparecem aqui quando um cliente com e-mail cadastra itens mas não finaliza a compra.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {carts.map((cart) => {
            const items = JSON.parse(cart.cartItems) as Array<{ name: string; price: number; quantity: number; image?: string }>;
            const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
            return (
              <div key={cart.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{cart.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Abandonado em {new Date(cart.updatedAt).toLocaleString("pt-BR")}
                    </p>
                    <div className="mt-3 space-y-1">
                      {items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                          {item.image && <img src={item.image} alt={item.name} className="w-8 h-8 object-cover rounded-lg bg-gray-100" />}
                          <span className="truncate">{item.name}</span>
                          <span className="text-gray-400 shrink-0">× {item.quantity}</span>
                          <span className="text-gray-700 font-semibold shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-sm font-bold text-gray-900">Total: {formatCurrency(total)}</p>
                  </div>
                  <button
                    onClick={() => handleSend(cart.id)}
                    disabled={sending === cart.id}
                    className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:opacity-90 transition-colors disabled:opacity-60"
                  >
                    <Send size={14} />
                    {sending === cart.id ? "Enviando..." : "Enviar lembrete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
