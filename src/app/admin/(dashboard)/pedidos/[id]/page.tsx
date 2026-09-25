"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface OrderDetails {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: string;
  total: number;
  createdAt: string;
  items: any[];
  melhorEnvioShipmentId?: string;
  trackingCode?: string;
  etiquetaUrl?: string;
  shipmentStatus?: string;
  labelValid?: boolean;
  labelError?: string;
}

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retracting, setRetracting] = useState(false);

  const id = params.id as string;

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${id}`);
        if (!res.ok) throw new Error("Pedido não encontrado");
        const data = await res.json();
        setOrder(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar pedido");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchOrder();
  }, [id]);

  const handleRetry = async () => {
    if (!order) return;
    setRetracting(true);
    try {
      const res = await fetch("/api/admin/shipment-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (data.success) {
        setOrder({ ...order, ...data });
      } else {
        setError(data.error || "Erro ao recriar etiqueta");
      }
    } catch (err) {
      setError("Erro ao recriar etiqueta");
    } finally {
      setRetracting(false);
    }
  };

  if (loading) return <div className="p-8">Carregando...</div>;
  if (error) return <div className="p-8 text-red-600">Erro: {error}</div>;
  if (!order) return <div className="p-8">Pedido não encontrado</div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <Link href="/admin/pedidos" className="text-blue-600 hover:underline mb-6 block">
        ← Voltar para Pedidos
      </Link>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-3xl font-bold mb-4">{order.orderNumber}</h1>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-gray-600">Cliente</p>
            <p className="font-semibold">{order.customerName}</p>
            <p className="text-sm text-gray-500">{order.customerEmail}</p>
            <p className="text-sm text-gray-500">{order.customerPhone}</p>
          </div>
          <div>
            <p className="text-gray-600">Status</p>
            <p className="font-semibold text-lg">{order.status}</p>
            <p className="text-gray-600">Total: R$ {order.total.toFixed(2)}</p>
            <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString("pt-BR")}</p>
          </div>
        </div>

        {/* Seção de Etiqueta Melhor Envio */}
        <div className="border-t pt-6">
          <h2 className="text-xl font-bold mb-4">📦 Status da Etiqueta - Melhor Envio</h2>

          {order.melhorEnvioShipmentId ? (
            <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-gray-600 text-sm">ID do Envio</p>
                  <p className="font-mono">{order.melhorEnvioShipmentId}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Código de Rastreamento</p>
                  <p className="font-mono">{order.trackingCode || "-"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-gray-600 text-sm">Status da Etiqueta</p>
                  <p className="font-semibold">
                    {order.shipmentStatus === "posted" && "✅ Etiqueta Criada"}
                    {order.shipmentStatus === "in_transit" && "🚚 Em Trânsito"}
                    {order.shipmentStatus === "delivered" && "✓ Entregue"}
                    {order.shipmentStatus === "cancelled" && "❌ Cancelada"}
                    {order.shipmentStatus === "exception" && "⚠️ Problema"}
                    {!order.shipmentStatus && "❓ Desconhecido"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Validação da Etiqueta</p>
                  <p className={order.labelValid ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                    {order.labelValid ? "✅ Válida" : "❌ Inválida"}
                  </p>
                </div>
              </div>

              {order.labelError && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                  <p className="text-red-800 font-semibold mb-1">Erro da Etiqueta:</p>
                  <p className="text-red-700">{order.labelError}</p>
                </div>
              )}

              {order.etiquetaUrl && (
                <div className="mb-4">
                  <a
                    href={order.etiquetaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    📄 Abrir Etiqueta
                  </a>
                </div>
              )}

              {!order.labelValid && (
                <button
                  onClick={handleRetry}
                  disabled={retracting}
                  className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:opacity-50"
                >
                  {retracting ? "Recriando..." : "🔄 Recriar Etiqueta"}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-yellow-800">⚠️ Nenhuma etiqueta criada ainda</p>
            </div>
          )}
        </div>

        {/* Itens do Pedido */}
        <div className="border-t pt-6 mt-6">
          <h2 className="text-xl font-bold mb-4">Itens do Pedido</h2>
          <div className="space-y-3">
            {order.items?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                <div>
                  <p className="font-semibold">{item.product?.name}</p>
                  <p className="text-sm text-gray-600">Quantidade: {item.quantity}</p>
                </div>
                <p className="font-semibold">R$ {item.price.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
