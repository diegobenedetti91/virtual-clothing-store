"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ShippingStats {
  labelInvalid: number;
  posted: number;
  inTransit: number;
  delivered: number;
  exception: number;
  cancelled: number;
  pending: number;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  trackingCode: string | null;
  shipmentStatus: string | null;
  labelValid: boolean | null;
  labelError: string | null;
  createdAt: string;
  trackingEvents: Array<{
    status: string;
    timestamp: string;
    location: string | null;
  }>;
}

export default function TrackingDashboard() {
  const [stats, setStats] = useState<ShippingStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [selectedFilter, searchTerm, orders]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/tracking-stats");
      const data = await response.json();

      setStats(data.stats);
      setOrders(data.orders || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    // Filtro por status
    if (selectedFilter !== "all") {
      if (selectedFilter === "labelInvalid") {
        filtered = filtered.filter((o) => o.labelValid === false);
      } else {
        filtered = filtered.filter((o) => o.shipmentStatus === selectedFilter);
      }
    }

    // Busca por número de pedido ou cliente
    if (searchTerm) {
      filtered = filtered.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          o.customerName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredOrders(filtered);
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "posted":
        return "📦";
      case "in_transit":
        return "🚚";
      case "delivered":
        return "✅";
      case "returned":
        return "↩️";
      case "exception":
        return "⚠️";
      case "cancelled":
        return "❌";
      default:
        return "⏳";
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case "posted":
        return "Aguardando Coleta";
      case "in_transit":
        return "Em Trânsito";
      case "delivered":
        return "Entregue";
      case "returned":
        return "Devolvido";
      case "exception":
        return "Exceção";
      case "cancelled":
        return "Cancelado";
      default:
        return "Processando";
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "posted":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "in_transit":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "delivered":
        return "bg-green-50 text-green-700 border-green-200";
      case "returned":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "exception":
        return "bg-red-50 text-red-700 border-red-200";
      case "cancelled":
        return "bg-gray-50 text-gray-700 border-gray-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Etiquetas Inválidas */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Etiquetas Inválidas</p>
              <p className="text-2xl font-bold text-red-700 mt-1">{stats?.labelInvalid || 0}</p>
            </div>
            <span className="text-3xl">⚠️</span>
          </div>
        </div>

        {/* Aguardando Coleta */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Aguardando Coleta</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">{stats?.posted || 0}</p>
            </div>
            <span className="text-3xl">📦</span>
          </div>
        </div>

        {/* Em Trânsito */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600 font-medium">Em Trânsito</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">{stats?.inTransit || 0}</p>
            </div>
            <span className="text-3xl">🚚</span>
          </div>
        </div>

        {/* Entregues */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Entregues</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{stats?.delivered || 0}</p>
            </div>
            <span className="text-3xl">✅</span>
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar por Pedido ou Cliente
            </label>
            <input
              type="text"
              placeholder="Ex: ORD-123456 ou João Silva"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Status
            </label>
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              <option value="labelInvalid">Etiquetas Inválidas</option>
              <option value="posted">Aguardando Coleta</option>
              <option value="in_transit">Em Trânsito</option>
              <option value="delivered">Entregues</option>
              <option value="exception">Exceções</option>
              <option value="cancelled">Cancelados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Pedidos */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Pedido</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cliente</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Código Rastreamento
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Último Evento
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Nenhum pedido encontrado
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const lastEvent = order.trackingEvents?.[0];
                  const isInvalid = order.labelValid === false;

                  return (
                    <tr key={order.id} className={isInvalid ? "bg-red-50" : ""}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {order.orderNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{order.customerName}</td>
                      <td className="px-4 py-3">
                        {isInvalid ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="text-xl">⚠️</span>
                            <span className="text-sm font-medium text-red-700">Etiqueta Inválida</span>
                          </div>
                        ) : (
                          <div
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(
                              order.shipmentStatus
                            )}`}
                          >
                            <span>{getStatusIcon(order.shipmentStatus)}</span>
                            <span>{getStatusLabel(order.shipmentStatus)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {order.trackingCode ? (
                          <a
                            href={`https://rastreamento.correios.com.br/?q=${order.trackingCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-mono"
                          >
                            {order.trackingCode}
                          </a>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {lastEvent ? (
                          <div className="text-xs">
                            <p className="font-medium">{lastEvent.status}</p>
                            <p className="text-gray-500">
                              {lastEvent.location && `📍 ${lastEvent.location}`}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Link
                          href={`/admin/pedidos/${order.id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          Ver Detalhes
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Informações */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <span className="text-xl">ℹ️</span>
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Sobre o Rastreamento:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Os dados são sincronizados automaticamente a cada 6 horas</li>
              <li>Etiquetas inválidas precisam ser corrigidas no Melhor Envio</li>
              <li>Clique no código de rastreamento para ver detalhes nos Correios</li>
              <li>Notificações por email são enviadas automaticamente ao cliente</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
