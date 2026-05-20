"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, Truck, RefreshCw, ChevronDown, ChevronUp, Weight, Box, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ItemInfo {
  productId: string;
  nome: string;
  quantidade: number;
  variante: string;
  volumeCm3: number;
  pesoGramas: number;
  embalagemNome: string | null;
}

interface PackagePresetRaw {
  id: string;
  name: string;
  comprimento: number;
  largura: number;
  altura: number;
  pesoGramas: number;
}

interface Sugestao {
  embalagens: PackagePresetRaw[];
  pesoTotalGramas: number;
  volumeTotalCm3: number;
  observacao: string;
  cabe: boolean;
}

interface EnvioOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  createdAt: string;
  itens: ItemInfo[];
  sugestao: Sugestao;
}

export default function EnviosManager() {
  const [orders, setOrders] = useState<EnvioOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [shipping, setShipping] = useState<{ id: string; trackingCode: string; saving: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/envios");
      const data = await res.json();
      setOrders(data.orders || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleMarkShipped = async (order: EnvioOrder) => {
    if (!shipping || shipping.id !== order.id) {
      setShipping({ id: order.id, trackingCode: "", saving: false });
      return;
    }
    setShipping((s) => s && { ...s, saving: true });
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SHIPPED", trackingCode: shipping.trackingCode || undefined }),
    });
    setShipping(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-20">
        <CheckCircle2 size={48} className="mx-auto text-green-400 mb-3" />
        <p className="text-gray-500 font-medium">Nenhum pedido confirmado aguardando envio.</p>
        <p className="text-gray-400 text-sm mt-1">Pedidos confirmados aparecem aqui com sugestão de embalagem.</p>
        <button onClick={load} className="mt-4 flex items-center gap-2 mx-auto text-sm text-brand hover:underline">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{orders.length} pedido{orders.length !== 1 ? "s" : ""} aguardando envio</p>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-brand transition">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {orders.map((order) => {
        const isExpanded = expanded.has(order.id);
        const isShipping = shipping?.id === order.id;
        const sugestao = order.sugestao;
        const pesoKg = (sugestao.pesoTotalGramas / 1000).toFixed(2);
        const caixas = sugestao.embalagens;
        const unicasCaixas = [...new Map(caixas.map((c) => [c.id ?? c.name, c])).values()];

        return (
          <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-sm font-bold text-gray-900">{order.orderNumber}</span>
                  <span className="text-sm text-gray-700">{order.customerName}</span>
                  {order.city && (
                    <span className="text-xs text-gray-400">{order.city}{order.state ? `/${order.state}` : ""}</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(order.createdAt).toLocaleDateString("pt-BR")} · {order.itens.reduce((s, i) => s + i.quantidade, 0)} peça{order.itens.reduce((s, i) => s + i.quantidade, 0) !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Packing summary badge */}
              <div className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${sugestao.cabe ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                <Box size={14} />
                {sugestao.observacao}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleExpand(order.id)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-gray-50 px-6 py-4 space-y-4">
                {/* Items */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Itens do pedido</p>
                  <div className="space-y-1.5">
                    {order.itens.map((item, i) => (
                      <div key={i} className="flex items-start justify-between text-sm">
                        <div>
                          <span className="font-medium text-gray-900">{item.nome}</span>
                          {item.variante && <span className="text-gray-400 ml-2 text-xs">({item.variante})</span>}
                          {item.embalagemNome && (
                            <span className="ml-2 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                              {item.embalagemNome}
                            </span>
                          )}
                        </div>
                        <div className="text-right text-xs text-gray-500 shrink-0 ml-4">
                          <span className="font-semibold text-gray-700">×{item.quantidade}</span>
                          <span className="ml-2">{item.pesoGramas * item.quantidade}g</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Packing suggestion */}
                <div className={`rounded-xl p-4 space-y-3 ${sugestao.cabe ? "bg-green-50 border border-green-100" : "bg-amber-50 border border-amber-100"}`}>
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Package size={15} />
                    Sugestão de empacotamento
                  </p>

                  {unicasCaixas.length > 0 ? (
                    <div className="space-y-2">
                      {unicasCaixas.map((caixa, i) => {
                        const qtd = caixas.filter((c) => (c.id ?? c.name) === (caixa.id ?? caixa.name)).length;
                        return (
                          <div key={i} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 shadow-sm">
                            <Box size={18} className="text-brand shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900">
                                {qtd > 1 ? `${qtd}× ` : ""}{caixa.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {caixa.comprimento}×{caixa.largura}×{caixa.altura} cm · Tara: {caixa.pesoGramas}g
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-amber-700">Cadastre embalagens para receber sugestões.</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-600 pt-1">
                    <span className="flex items-center gap-1"><Weight size={12} /> Peso total: <strong>{pesoKg} kg</strong></span>
                    <span className="flex items-center gap-1"><Box size={12} /> Volume: <strong>{(sugestao.volumeTotalCm3 / 1000).toFixed(1)} L</strong></span>
                  </div>
                  <p className={`text-xs font-medium ${sugestao.cabe ? "text-green-700" : "text-amber-700"}`}>
                    {sugestao.observacao}
                  </p>
                </div>

                {/* Ship action */}
                <div className="flex items-end gap-3 pt-1">
                  {isShipping ? (
                    <>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">Código de rastreio (opcional)</label>
                        <input
                          autoFocus
                          value={shipping.trackingCode}
                          onChange={(e) => setShipping((s) => s && { ...s, trackingCode: e.target.value })}
                          placeholder="Ex: BR123456789BR"
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                      </div>
                      <button
                        onClick={() => handleMarkShipped(order)}
                        disabled={shipping.saving}
                        className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
                      >
                        <Truck size={15} />
                        {shipping.saving ? "Salvando..." : "Confirmar envio"}
                      </button>
                      <button onClick={() => setShipping(null)} className="px-3 py-2 text-gray-400 hover:text-gray-600 text-sm border border-gray-200 rounded-xl">
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleMarkShipped(order)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:opacity-90 transition shadow-sm"
                    >
                      <Truck size={15} />
                      Marcar como enviado
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
