"use client";

import { useEffect, useState } from "react";

interface TrackingEvent {
  status: string;
  location: string | null;
  timestamp: string;
  details: string | null;
}

interface TrackingData {
  orderNumber: string;
  shipmentStatus: string | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  etiquetaUrl: string | null;
  labelValid: boolean | null;
  labelError: string | null;
  lastTrackingUpdate: string | null;
  message: string;
  trackingEvents: TrackingEvent[];
}

interface OrderTrackingProps {
  orderId: string;
}

export default function OrderTracking({ orderId }: OrderTrackingProps) {
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTracking();
  }, [orderId]);

  const fetchTracking = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/customer/orders/${orderId}/tracking`);

      if (!response.ok) {
        throw new Error("Erro ao buscar rastreamento");
      }

      const data = await response.json();
      setTracking(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
        <div className="h-20 bg-gray-200 rounded-lg animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">❌ {error}</p>
        <button
          onClick={fetchTracking}
          className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  if (!tracking) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-600">Nenhum rastreamento disponível</p>
      </div>
    );
  }

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

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "posted":
        return "bg-blue-50 border-blue-200 text-blue-700";
      case "in_transit":
        return "bg-yellow-50 border-yellow-200 text-yellow-700";
      case "delivered":
        return "bg-green-50 border-green-200 text-green-700";
      case "returned":
        return "bg-purple-50 border-purple-200 text-purple-700";
      case "exception":
        return "bg-red-50 border-red-200 text-red-700";
      case "cancelled":
        return "bg-gray-50 border-gray-200 text-gray-700";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Principal */}
      <div className={`border rounded-lg p-6 ${getStatusColor(tracking.shipmentStatus)}`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-4xl">{getStatusIcon(tracking.shipmentStatus)}</span>
          <div>
            <p className="text-sm font-medium opacity-75">Status do Envio</p>
            <p className="text-2xl font-bold">{tracking.message}</p>
          </div>
        </div>

        {/* Informações de Rastreamento */}
        {tracking.trackingCode && (
          <div className="mt-4 pt-4 border-t border-current border-opacity-20 space-y-2">
            <div>
              <p className="text-sm opacity-75">Código de Rastreamento</p>
              <p className="font-mono font-bold">{tracking.trackingCode}</p>
            </div>

            {tracking.trackingUrl && (
              <a
                href={tracking.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 bg-current bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded text-sm font-medium transition"
              >
                🔗 Rastrear nos Correios
              </a>
            )}
          </div>
        )}

        {tracking.etiquetaUrl && tracking.labelValid && (
          <a
            href={tracking.etiquetaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 ml-2 bg-current bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded text-sm font-medium transition"
          >
            🖨️ Baixar Etiqueta
          </a>
        )}
      </div>

      {/* Erro de Etiqueta */}
      {tracking.labelError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">
            <strong>⚠️ Aviso:</strong> {tracking.labelError}
          </p>
          <p className="text-red-600 text-sm mt-2">
            Nossa equipe está resolvendo este problema. Você será notificado quando tudo estiver pronto.
          </p>
        </div>
      )}

      {/* Timeline de Eventos */}
      {tracking.trackingEvents && tracking.trackingEvents.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Histórico de Rastreamento</h3>

          <div className="space-y-4">
            {tracking.trackingEvents.map((event, index) => (
              <div key={index} className="flex gap-4">
                {/* Timeline dot */}
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 bg-blue-600 rounded-full mt-1.5"></div>
                  {index < tracking.trackingEvents.length - 1 && (
                    <div className="w-0.5 h-12 bg-gray-300 my-1"></div>
                  )}
                </div>

                {/* Event content */}
                <div className="pb-4">
                  <p className="font-semibold text-gray-900">{event.status}</p>
                  {event.location && (
                    <p className="text-sm text-gray-600">📍 {event.location}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(event.timestamp).toLocaleString("pt-BR")}
                  </p>
                  {event.details && (
                    <p className="text-sm text-gray-700 mt-2">{event.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-900 text-sm">
          <strong>ℹ️ Informação:</strong> O rastreamento é atualizado automaticamente a cada 6 horas.
          Se você já recebeu o pacote, esta página pode levar alguns minutos para atualizar.
        </p>
      </div>

      {/* Botão de Atualizar */}
      <button
        onClick={fetchTracking}
        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
      >
        🔄 Atualizar Rastreamento
      </button>
    </div>
  );
}
