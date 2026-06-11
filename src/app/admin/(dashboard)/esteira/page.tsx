"use client";

import { useEffect, useState, useCallback } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Trash2, CheckCircle, RefreshCw } from "lucide-react";

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

const STATUSES: { id: OrderStatus; label: string; color: string }[] = [
  { id: "PENDING", label: "Aguardando", color: "bg-yellow-100" },
  { id: "CONFIRMED", label: "Confirmado", color: "bg-blue-100" },
  { id: "PRONTO_PARA_RETIRADA", label: "Pronto para Retirada", color: "bg-orange-100" },
  { id: "SHIPPED", label: "Enviado", color: "bg-purple-100" },
  { id: "RETIRADO", label: "Retirado", color: "bg-green-100" },
  { id: "DELIVERED", label: "Entregue", color: "bg-green-100" },
];

export default function EsteirPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | "">("");

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000); // Atualiza a cada 5s
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

  const selectAll = (status: OrderStatus) => {
    const statusOrders = orders.filter((o) => o.status === status).map((o) => o.id);
    const newSelected = new Set(selected);
    statusOrders.forEach((id) => {
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
    });
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Esteira de Pedidos</h1>
          <p className="text-gray-500 mt-1">Acompanhe pedidos em tempo real</p>
        </div>
        <button
          onClick={fetchOrders}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Ações em lote */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-4">
          <span className="font-semibold text-blue-900">{selected.size} selecionado(s)</span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
            className="px-3 py-2 border border-blue-300 rounded-lg text-sm"
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            <CheckCircle size={16} className="inline mr-2" />
            Atualizar
          </button>
        </div>
      )}

      {/* Kanban board */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {STATUSES.map((statusCol) => {
          const statusOrders = orders.filter((o) => o.status === statusCol.id);
          const allSelected = statusOrders.length > 0 && statusOrders.every((o) => selected.has(o.id));

          return (
            <div
              key={statusCol.id}
              className={`${statusCol.color} rounded-lg p-4 min-h-96 flex flex-col`}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-gray-900">{statusCol.label}</h2>
                <span className="bg-white px-2 py-1 rounded text-xs font-semibold text-gray-700">
                  {statusOrders.length}
                </span>
              </div>

              {statusOrders.length > 0 && (
                <button
                  onClick={() => selectAll(statusCol.id)}
                  className="text-xs text-gray-600 hover:text-gray-900 mb-3 font-medium"
                >
                  {allSelected ? "Desselecionar todos" : "Selecionar todos"}
                </button>
              )}

              <div className="space-y-3 flex-1">
                {statusOrders.map((order) => (
                  <div
                    key={order.id}
                    className={`bg-white rounded-lg p-3 border-2 cursor-pointer transition-all ${
                      selected.has(order.id) ? "border-blue-500 shadow-md" : "border-transparent hover:shadow"
                    }`}
                    onClick={() => toggleSelect(order.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{order.orderNumber}</p>
                        <p className="text-xs text-gray-600 truncate">{order.customerName}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatCurrency(order.total)}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded border-2 flex-shrink-0 transition-colors ${
                          selected.has(order.id)
                            ? "bg-blue-500 border-blue-500"
                            : "border-gray-300 hover:border-blue-400"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {selected.has(order.id) && <CheckCircle size={16} className="text-white" />}
                      </div>
                    </div>

                    {/* Menu rápido de status */}
                    <div className="mt-3 flex gap-1 flex-wrap">
                      {STATUSES.filter((s) => s.id !== statusCol.id)
                        .slice(0, 2)
                        .map((s) => (
                          <button
                            key={s.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateOrderStatus(order.id, s.id);
                            }}
                            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-medium transition-colors"
                          >
                            {s.label}
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>

              {statusOrders.length === 0 && (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  Nenhum pedido
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
