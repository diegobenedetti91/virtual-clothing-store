"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, MessageCircle, AlertCircle, Package, Undo2 } from "lucide-react";
import Link from "next/link";
import { Order } from "@/types";
import { formatCurrency, formatDate, ORDER_STATUS } from "@/lib/utils";
import ReturnRequestModal from "@/components/ReturnRequestModal";

export default function OrderConfirmationPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnRequested, setReturnRequested] = useState(false);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((data) => setOrder(data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-96"><div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full" /></div>;
  if (!order) return <div className="text-center py-20"><p>Pedido não encontrado.</p></div>;

  const statusInfo = ORDER_STATUS[order.status] || ORDER_STATUS.PENDING;
const daysSinceOrder = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const canRequestReturn = daysSinceOrder <= 7;

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <CheckCircle size={72} className="mx-auto text-green-500 mb-4" />
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Pedido enviado!</h1>
      <p className="text-gray-500 mb-2">Obrigada por comprar conosco.</p>
      <p className="text-gray-500 mb-8 flex items-center justify-center gap-2">
        <MessageCircle size={16} className="text-green-500" />
        Aguarde nosso contato pelo WhatsApp para combinar pagamento e entrega.
      </p>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm text-left mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-xs text-gray-500">Número do pedido</p>
            <p className="font-bold text-lg">{order.orderNumber}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-4">{formatDate(order.createdAt)}</p>

        <h3 className="font-semibold text-gray-900 mb-4">Itens do pedido</h3>
        <div className="space-y-4 mb-6">
          {order.items.map((item) => {
            const images = item.product.images ? JSON.parse(item.product.images) : [];
            const image = images[0];
            return (
              <div key={item.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                {image && (
                  <img
                    src={image}
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                )}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{item.product.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.size ? `Tamanho: ${item.size}` : ""}
                      {item.color && item.size ? " • " : ""}
                      {item.color ? `Cor: ${item.color}` : ""}
                    </p>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-sm text-gray-600">Qtd: {item.quantity}</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-gray-100 pt-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span className="font-medium">{formatCurrency(order.subtotal)}</span>
          </div>
          {order.shippingCost > 0 ? (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Frete{order.shippingMethod ? ` (${order.shippingMethod})` : ""}</span>
              <span className="font-medium">{formatCurrency(order.shippingCost)}</span>
            </div>
          ) : (
            <div className="flex justify-between text-sm text-gray-400">
              <span>Frete</span>
              <span>A combinar</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-600">
            <span>Forma de pagamento</span>
            <span className="font-medium">
              {order.paymentGateway === "mercadopago"
                ? "Mercado Pago"
                : order.paymentGateway === "nupay"
                ? "NuPay"
                : "A combinar"}
            </span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 pt-3 border-t border-gray-100">
            <span>Total</span>
            <span className="text-lg">{formatCurrency(order.total)}</span>
          </div>
        </div>

        <div className="border-t border-gray-100 mt-4 pt-4">
          <h3 className="font-semibold text-gray-900 mb-2">Dados do cliente</h3>
          <p className="text-sm text-gray-700">{order.customerName}</p>
          <p className="text-sm text-gray-500">{order.customerPhone}</p>
          {order.customerEmail && <p className="text-sm text-gray-500">{order.customerEmail}</p>}
          {order.address && <p className="text-sm text-gray-500">{order.address}</p>}
        </div>

        {order.trackingCode && (
          <div className="border-t border-gray-100 mt-4 pt-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package size={18} />
              Rastreamento em Tempo Real
            </h3>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-xs text-blue-700 mb-1 font-semibold">CÓDIGO DE RASTREAMENTO</p>
              <p className="text-lg font-mono font-bold text-blue-900 mb-3">{order.trackingCode}</p>
              {order.trackingUrl && (
                <a 
                  href={order.trackingUrl} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-semibold"
                >
                  🔍 Rastrear no Melhor Envio →
                </a>
              )}
            </div>

            {order.shipmentStatus && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-xs text-gray-600 mb-2 font-semibold">STATUS DO ENVIO</p>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 capitalize">
                      {order.shipmentStatus === 'posted' ? '📦 Postado' : 
                       order.shipmentStatus === 'in_transit' ? '🚚 Em Trânsito' :
                       order.shipmentStatus === 'out_for_delivery' ? '📍 Saindo para Entrega' :
                       order.shipmentStatus === 'delivered' ? '✅ Entregue' :
                       order.shipmentStatus}
                    </p>
                    {order.lastTrackingUpdate && (
                      <p className="text-xs text-gray-500 mt-1">
                        Atualizado em {new Date(order.lastTrackingUpdate).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-gray-100 mt-6 pt-6">
            <div>
              {canRequestReturn && !returnRequested ? (
                <div>
                  <p className="text-xs text-gray-500 mb-3">Tem 7 dias para solicitar devolução do produto.</p>
                  <button
                    onClick={() => setReturnModalOpen(true)}
                    className="w-full bg-orange-600 text-white py-2 rounded-lg font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Undo2 size={16} />
                    Solicitar Devolução
                  </button>
                </div>
              ) : returnRequested ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-blue-800">✅ Devolução solicitada</p>
                  <p className="text-xs text-blue-700 mt-1">Você receberá um email com mais informações em breve.</p>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-600 flex items-center gap-2">
                    <AlertCircle size={14} />
                    Prazo para devolução expirado (máximo 7 dias)
                  </p>
                </div>
              )}
            </div>
        </div>
      </div>

      <Link href="/produtos" className="bg-brand text-white px-8 py-3 rounded-full font-semibold hover:opacity-90 transition-colors inline-block">
        Continuar comprando
      </Link>

      <ReturnRequestModal
        orderId={order.id}
        orderNumber={order.orderNumber}
        items={order.items}
        isOpen={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        onSuccess={() => setReturnRequested(true)}
      />
    </div>
  );
}
