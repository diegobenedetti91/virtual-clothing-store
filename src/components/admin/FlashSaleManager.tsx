"use client";

import { useEffect, useState } from "react";
import { Zap, Trash2, Send } from "lucide-react";

interface FlashSale {
  id: string;
  title: string;
  productId: string | null;
  discountType: string;
  discountValue: number;
  startAt: string;
  endAt: string;
  active: boolean;
  notifySent: boolean;
  product: { name: string; slug: string; price: number } | null;
}

export default function FlashSaleManager() {
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState({
    title: "",
    productId: "",
    discountType: "PERCENT",
    discountValue: 0,
    startAt: "",
    endAt: "",
  });
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/flash-sales");
      const data = await res.json();
      setFlashSales(data);
    } catch (error) {
      console.error("Error loading flash sales:", error);
    }
    setLoading(false);
  };

  const loadProducts = async () => {
    try {
      const res = await fetch("/api/products?limit=999");
      const data = await res.json();
      setProducts(data.data || []);
    } catch (error) {
      console.error("Error loading products:", error);
    }
  };

  useEffect(() => {
    load();
    loadProducts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/flash-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          discountValue: parseFloat(form.discountValue as any),
        }),
      });
      if (res.ok) {
        setForm({
          title: "",
          productId: "",
          discountType: "PERCENT",
          discountValue: 0,
          startAt: "",
          endAt: "",
        });
        setFormVisible(false);
        load();
      }
    } catch (error) {
      console.error("Error creating flash sale:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deletar esta flash sale?")) return;
    try {
      await fetch(`/api/admin/flash-sales?id=${id}`, { method: "DELETE" });
      load();
    } catch (error) {
      console.error("Error deleting flash sale:", error);
    }
  };

  const handleNotify = async (id: string) => {
    try {
      const res = await fetch("/api/admin/flash-sales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, notifySent: true }),
      });
      if (res.ok) load();
    } catch (error) {
      console.error("Error notifying:", error);
    }
  };

  if (loading)
    return <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">Flash Sales</h2>
        <button
          onClick={() => setFormVisible(!formVisible)}
          className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:opacity-90"
        >
          + Nova Flash Sale
        </button>
      </div>

      {formVisible && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="ex: Desconto Black Friday"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Produto *</label>
            <select
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">Selecionar...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Desconto *</label>
              <select
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="PERCENT">Porcentagem (%)</option>
                <option value="FIXED">Valor Fixo (R$)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desconto *</label>
              <input
                type="number"
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: parseFloat(e.target.value) || 0 })}
                required
                step="0.01"
                min="0"
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Início *</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fim *</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:opacity-90">
              Criar Flash Sale
            </button>
            <button
              type="button"
              onClick={() => setFormVisible(false)}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {flashSales.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center text-gray-400 text-sm">
          Nenhuma flash sale criada ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {flashSales.map((sale) => {
            const now = new Date();
            const isActive = new Date(sale.startAt) <= now && new Date(sale.endAt) >= now;
            const isPast = new Date(sale.endAt) < now;

            return (
              <div key={sale.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap size={16} className="text-yellow-500" />
                      <span className="text-sm font-bold text-gray-900">{sale.title}</span>
                      {isActive && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">ATIVA</span>}
                      {isPast && <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-bold">EXPIRADA</span>}
                    </div>

                    {sale.product ? (
                      <>
                        <p className="text-xs text-brand font-medium">{sale.product.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {sale.discountType === "PERCENT"
                            ? `${sale.discountValue}% de desconto`
                            : `R$ ${sale.discountValue.toFixed(2)} de desconto`}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(sale.startAt).toLocaleString("pt-BR")} — {new Date(sale.endAt).toLocaleString("pt-BR")}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400">Produto deletado</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isActive && !sale.notifySent && (
                      <button
                        onClick={() => handleNotify(sale.id)}
                        title="Notificar via WhatsApp"
                        className="p-2 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                      >
                        <Send size={15} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(sale.id)} title="Deletar" className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
