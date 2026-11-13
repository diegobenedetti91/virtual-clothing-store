"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { needsMelhorEnvioLabel } from "@/lib/utils";

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
  shippingMethod?: string | null;
  shipmentRetryError?: string | null;
  blingIntegrationStatus?: string | null;
  blingPedidoId?: string | null;
  blingIntegratedAt?: string | null;
  trafficChannel?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  trafficReferrer?: string | null;
  landingPage?: string | null;
}

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retracting, setRetracting] = useState(false);
  const [shipmentMsg, setShipmentMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [blingEnabled, setBlingEnabled] = useState(false);
  const [sendingBling, setSendingBling] = useState(false);
  const [blingMsg, setBlingMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setBlingEnabled(!!s?.blingAtivo))
      .catch(() => {});
  }, []);

  const handleBlingRetry = async () => {
    if (!order) return;
    setSendingBling(true);
    setBlingMsg(null);
    try {
      const res = await fetch("/api/admin/pedidos/bling-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrder({
          ...order,
          blingIntegrationStatus: "success",
          blingPedidoId: data.blingId,
          blingIntegratedAt: new Date().toISOString(),
        });
        setBlingMsg({ type: "success", text: `Pedido enviado ao Bling (ID: ${data.blingId})` });
      } else {
        setOrder({ ...order, blingIntegrationStatus: "error" });
        setBlingMsg({ type: "error", text: data.error || "Erro ao enviar ao Bling" });
      }
    } catch {
      setBlingMsg({ type: "error", text: "Erro ao chamar a API" });
    } finally {
      setSendingBling(false);
    }
  };

  const handleRetry = async () => {
    if (!order) return;
    setRetracting(true);
    setShipmentMsg(null);
    try {
      const res = await fetch("/api/admin/shipment-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (data.success) {
        setOrder({ ...order, ...data });
        setShipmentMsg({ type: "success", text: data.message || "Etiqueta criada" });
      } else {
        const msg = data.error || data.message || "Erro ao gerar etiqueta";
        setOrder({ ...order, shipmentRetryError: msg });
        setShipmentMsg({ type: "error", text: msg });
      }
    } catch (err) {
      setShipmentMsg({ type: "error", text: "Erro ao gerar etiqueta" });
    } finally {
      setRetracting(false);
    }
  };

  if (loading) return <div className="p-8">Carregando...</div>;
  if (error) return <div className="p-8 text-red-600">Erro: {error}</div>;
  if (!order) return <div className="p-8">Pedido não encontrado</div>;

  const isPaid = order.status !== "PENDING" && order.status !== "CANCELLED";
  const usesLabel = needsMelhorEnvioLabel(order.shippingMethod);
  const blingIntegrated = order.blingIntegrationStatus === "success" && !!order.blingPedidoId;
  const msgClass = (type: "success" | "error") =>
    `mt-3 text-sm rounded p-3 ${type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`;

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
          <div className="col-span-2">
            <p className="text-gray-600">Origem do cliente</p>
            <p className="font-semibold">{order.trafficChannel || "Não identificado"}</p>
            {(order.utmSource || order.utmMedium || order.utmCampaign) && (
              <p className="text-sm text-gray-500">
                {[order.utmSource, order.utmMedium, order.utmCampaign].map((v) => v || "—").join(" / ")}
              </p>
            )}
            {(order.trafficReferrer || order.landingPage) && (
              <p className="text-sm text-gray-500">
                {order.trafficReferrer ? `Veio de ${order.trafficReferrer}` : ""}
                {order.trafficReferrer && order.landingPage ? " · " : ""}
                {order.landingPage ? `Entrou por ${order.landingPage}` : ""}
              </p>
            )}
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

              {order.labelValid === false && (
                <button
                  onClick={handleRetry}
                  disabled={retracting}
                  className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:opacity-50"
                >
                  {retracting ? "Recriando..." : "🔄 Recriar Etiqueta"}
                </button>
              )}
            </div>
          ) : !usesLabel ? (
            <div className="bg-gray-50 border border-gray-200 rounded p-4">
              <p className="text-gray-700">Entrega local / retirada na loja — não usa etiqueta.</p>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-yellow-800">⚠️ Nenhuma etiqueta criada ainda</p>
              {order.shipmentRetryError && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mt-3">
                  <p className="text-red-800 font-semibold mb-1">Último erro na geração:</p>
                  <p className="text-red-700 text-sm break-words">{order.shipmentRetryError}</p>
                </div>
              )}
              {isPaid && (
                <button
                  onClick={handleRetry}
                  disabled={retracting}
                  className="mt-3 bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:opacity-50"
                >
                  {retracting ? "Gerando..." : "📦 Gerar Etiqueta"}
                </button>
              )}
            </div>
          )}
          {shipmentMsg && <p className={msgClass(shipmentMsg.type)}>{shipmentMsg.text}</p>}
        </div>

        {/* Seção Bling */}
        {blingEnabled && (
          <div className="border-t pt-6 mt-6">
            <h2 className="text-xl font-bold mb-4">🧾 Integração Bling</h2>
            {blingIntegrated ? (
              <div className="bg-green-50 border border-green-200 rounded p-4">
                <p className="text-green-800 font-semibold">✅ Integrado (ID Bling: {order.blingPedidoId})</p>
                {order.blingIntegratedAt && (
                  <p className="text-sm text-green-700">
                    em {new Date(order.blingIntegratedAt).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            ) : !isPaid ? (
              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <p className="text-gray-700">O pedido é enviado ao Bling quando o pagamento é aprovado.</p>
              </div>
            ) : (
              <div className={`${order.blingIntegrationStatus === "error" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"} border rounded p-4`}>
                <p className={order.blingIntegrationStatus === "error" ? "text-red-800 font-semibold" : "text-yellow-800"}>
                  {order.blingIntegrationStatus === "error"
                    ? "❌ Falha ao enviar o pedido ao Bling"
                    : "⚠️ Pedido pago ainda não enviado ao Bling"}
                </p>
                <button
                  onClick={handleBlingRetry}
                  disabled={sendingBling}
                  className="mt-3 bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:opacity-50"
                >
                  {sendingBling ? "Enviando..." : "🔄 Enviar ao Bling"}
                </button>
              </div>
            )}
            {blingMsg && <p className={msgClass(blingMsg.type)}>{blingMsg.text}</p>}
          </div>
        )}

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
