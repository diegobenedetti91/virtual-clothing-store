"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { RefreshCw, ChevronRight, Package, Truck, Check } from "lucide-react";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: string;
  paymentMethod?: string;
  shippingMethod?: string;
  shippingCost?: number;
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

const STATUSES: { id: OrderStatus; label: string; description: string }[] = [
  { id: "PENDING", label: "Aguardando", description: "Pagamento em aguardo" },
  { id: "CONFIRMED", label: "Confirmado", description: "Pagamento confirmado" },
  { id: "PRONTO_PARA_RETIRADA", label: "Pronto p/ Retirada", description: "Aguardando retirada" },
  { id: "SHIPPED", label: "Enviado", description: "Em transporte" },
  { id: "RETIRADO", label: "Retirado", description: "Cliente retirou" },
  { id: "DELIVERED", label: "Entregue", description: "Entregue ao cliente" },
];

export default function EsteirPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | "">("");

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
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } catch (err) {
      console.error("Erro ao atualizar pedido:", err);
    }
  };

  const bulkUpdate = async () => {
    if (!bulkStatus || selected.size === 0) return;

    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          fetch(`/api/orders/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: bulkStatus }),
          })
        )
      );
      setOrders((prev) =>
        prev.map((o) => (selected.has(o.id) ? { ...o, status: bulkStatus as OrderStatus } : o))
      );
      setSelected(new Set());
      setBulkStatus("");
    } catch (err) {
      console.error("Erro ao atualizar em lote:", err);
    }
  };

  const toggleSelect = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
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
          <h1 className="text-4xl font-bold text-gray-900">Esteira de Pedidos</h1>
          <p className="text-gray-600 mt-2">Gerencie todos os pedidos em um único lugar</p>
        </div>
        <button
          onClick={fetchOrders}
          className="p-3 bg-white border-2 border-gray-200 hover:bg-gray-50 rounded-lg transition-all"
        >
          <RefreshCw size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Ações em lote */}
      {selected.size > 0 && (
        <div className="bg-white border-2 border-blue-500 rounded-lg p-4 flex items-center gap-4 shadow-sm">
          <span className="font-bold text-gray-900 text-lg">{selected.size} pedido(s) selecionado(s)</span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
            className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium bg-white hover:border-gray-300"
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
            className="ml-auto text-gray-600 hover:text-gray-900 font-medium"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 pb-8">
        {STATUSES.map((statusCol) => {
          const statusOrders = orders.filter((o) => o.status === statusCol.id);

          return (
            <div key={statusCol.id} className="flex flex-col h-full">
              {/* Header da coluna */}
              <div className="bg-white border-2 border-gray-200 rounded-t-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-gray-900 text-sm">{statusCol.label}</h2>
                  <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold">
                    {statusOrders.length}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{statusCol.description}</p>
              </div>

              {/* Cards dos pedidos */}
              <div className="bg-gray-50 border-2 border-t-0 border-gray-200 rounded-b-lg p-3 space-y-3 min-h-96 overflow-y-auto flex-1">
                {statusOrders.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm font-medium">
                    Nenhum pedido
                  </div>
                ) : (
                  statusOrders.map((order) => (
                    <div
                      key={order.id}
                      className={`bg-white rounded-lg p-3.5 border-2 transition-all cursor-pointer group ${
                        selected.has(order.id)
                          ? "border-blue-500 ring-2 ring-blue-200 shadow-md"
                          : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                      }`}
                    >
                      {/* Checkbox + Info */}
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(order.id)}
                          onChange={(e) => toggleSelect(e as any, order.id)}
                          className="w-5 h-5 rounded-md mt-0.5 cursor-pointer accent-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-sm">{order.orderNumber}</p>
                          <p className="text-xs text-gray-600 truncate">{order.customerName}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="font-bold text-gray-900">{formatCurrency(order.total)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Método e Tipo de Entrega */}
                      <div className="mt-3 space-y-2 border-t border-gray-100 pt-2">
                        {order.paymentMethod && (
                          <div className="text-xs">
                            <span className="text-gray-500">Pagamento: </span>
                            <span className="font-medium text-gray-900">{order.paymentMethod}</span>
                          </div>
                        )}
                        {order.shippingMethod && (
                          <div className="text-xs">
                            <span className="text-gray-500">Entrega: </span>
                            <span className="font-medium text-gray-900">{order.shippingMethod}</span>
                          </div>
                        )}
                      </div>

                      {/* Menu de ações */}
                      <div className="mt-3 flex gap-2">
                        {ALLOWED_TRANSITIONS[statusCol.id as OrderStatus]?.map((newStatus) => {
                          const targetStatus = STATUSES.find((s) => s.id === newStatus);
                          return (
                            <button
                              key={newStatus}
                              onClick={() => updateOrderStatus(order.id, newStatus)}
                              className="flex-1 px-2 py-1.5 text-xs font-medium bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700 rounded transition-all border border-transparent hover:border-blue-300"
                            >
                              {newStatus === "CANCELLED" ? "❌" : "→"} {targetStatus?.label}
                            </button>
                          );
                        })}
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
