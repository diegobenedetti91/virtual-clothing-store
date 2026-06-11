"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { RefreshCw, ChevronDown, MoreVertical } from "lucide-react";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: string;
  paymentGateway?: string;
  paymentMethod?: string;
}

type OrderStatus = "PENDING" | "CONFIRMED" | "PRONTO_PARA_RETIRADA" | "SHIPPED" | "RETIRADO" | "DELIVERED" | "CANCELLED";

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "PRONTO_PARA_RETIRADA", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  PRONTO_PARA_RETIRADA: ["RETIRADO", "CANCELLED"],
  RETIRADO: ["CANCELLED"],
  DELIVERED: ["CANCELLED"],
  CANCELLED: [],
};

const STATUSES: { id: OrderStatus; label: string; color: string; icon: string }[] = [
  { id: "PENDING", label: "Aguardando", color: "from-yellow-50 to-yellow-100", icon: "⏳" },
  { id: "CONFIRMED", label: "Confirmado", color: "from-blue-50 to-blue-100", icon: "✅" },
  { id: "PRONTO_PARA_RETIRADA", label: "Pronto p/ Retirada", color: "from-orange-50 to-orange-100", icon: "📦" },
  { id: "SHIPPED", label: "Enviado", color: "from-purple-50 to-purple-100", icon: "🚚" },
  { id: "RETIRADO", label: "Retirado", color: "from-emerald-50 to-emerald-100", icon: "🏪" },
  { id: "DELIVERED", label: "Entregue", color: "from-green-50 to-green-100", icon: "🎉" },
];

export default function EsteirPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | "">("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/admin/relatorios");
      const data = await res.json();
      setOrders(data.orders);
    } catch (err) {
      console.error("Erro ao carregar pedidos:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
        setOpenMenuId(null);
      }
    } catch (err) {
      console.error("Erro ao atualizar pedido:", err);
    }
  };

  const bulkUpdate = async () => {
    if (!bulkStatus || selected.size === 0) return;

    try {
      const updates = Array.from(selected).map((id) =>
        fetch(`/api/orders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: bulkStatus }),
        })
      );

      await Promise.all(updates);
      setOrders((prev) =>
        prev.map((o) => (selected.has(o.id) ? { ...o, status: bulkStatus as OrderStatus } : o))
      );
      setSelected(new Set());
      setBulkStatus("");
    } catch (err) {
      console.error("Erro ao atualizar em lote:", err);
    }
  };

  const toggleSelect = (orderId: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelected(newSelected);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Esteira de Pedidos</h1>
          <p className="text-gray-500 mt-1">Acompanhe e gerencie pedidos em tempo real</p>
        </div>
        <button
          onClick={fetchOrders}
          className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Ações em lote */}
      {selected.size > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-4 flex items-center gap-4">
          <span className="font-bold text-blue-900 text-lg">{selected.size} pedido(s) selecionado(s)</span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
            className="px-3 py-2 border-2 border-blue-300 rounded-lg text-sm font-medium bg-white"
          >
            <option value="">Alterar para...</option>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={bulkUpdate}
            disabled={!bulkStatus}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-60 transition-all"
          >
            Atualizar
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto px-4 py-2 text-blue-600 hover:bg-blue-200 rounded-lg font-medium transition-all"
          >
            Limpar
          </button>
        </div>
      )}

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {STATUSES.map((statusCol) => {
          const statusOrders = orders.filter((o) => o.status === statusCol.id);

          return (
            <div
              key={statusCol.id}
              className={`bg-gradient-to-br ${statusCol.color} rounded-lg border-2 border-gray-200 p-4 min-h-96 flex flex-col`}
            >
              {/* Header da coluna */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-gray-300">
                <span className="text-2xl">{statusCol.icon}</span>
                <div className="flex-1">
                  <h2 className="font-bold text-gray-900 text-sm">{statusCol.label}</h2>
                </div>
                <span className="bg-white px-3 py-1 rounded-full text-xs font-bold text-gray-700 shadow">
                  {statusOrders.length}
                </span>
              </div>

              {/* Cards dos pedidos */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {statusOrders.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm font-medium">
                    Nenhum pedido
                  </div>
                ) : (
                  statusOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => toggleSelect(order.id)}
                      className={`bg-white rounded-lg p-3.5 border-2 cursor-pointer transition-all hover:shadow-md ${
                        selected.has(order.id)
                          ? "border-blue-500 shadow-lg ring-2 ring-blue-300"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {/* Checkbox */}
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            selected.has(order.id)
                              ? "bg-blue-500 border-blue-500"
                              : "border-gray-300 hover:border-blue-400"
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {selected.has(order.id) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{order.orderNumber}</p>
                          <p className="text-xs text-gray-600 truncate">{order.customerName}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-bold text-gray-900">{formatCurrency(order.total)}</span>
                            {order.paymentMethod && (
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded font-medium">
                                {order.paymentMethod}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Menu */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === order.id ? null : order.id);
                            }}
                            className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                          >
                            <MoreVertical size={14} className="text-gray-500" />
                          </button>

                          {/* Dropdown */}
                          {openMenuId === order.id && (
                            <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-200 z-10 py-1">
                              {ALLOWED_TRANSITIONS[statusCol.id as OrderStatus]?.map((newStatus) => {
                                const targetStatus = STATUSES.find((s) => s.id === newStatus);
                                return (
                                  <button
                                    key={newStatus}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateOrderStatus(order.id, newStatus);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors font-medium"
                                  >
                                    {targetStatus?.icon} {targetStatus?.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
