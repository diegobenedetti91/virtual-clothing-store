"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Order } from "@/types";
import { formatCurrency, formatDate, ORDER_STATUS } from "@/lib/utils";

export default function OrderConfirmationPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then(setOrder)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-96"><div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full" /></div>;
  if (!order) return <div className="text-center py-20"><p>Pedido não encontrado.</p></div>;

  const statusInfo = ORDER_STATUS[order.status] || ORDER_STATUS.PENDING;

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

        <h3 className="font-semibold text-gray-900 mb-3">Itens do pedido</h3>
        <div className="space-y-2 mb-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm text-gray-700">
              <span>
                {item.product.name} × {item.quantity}
                {item.size ? ` (${item.size})` : ""}
                {item.color ? ` - ${item.color}` : ""}
              </span>
              <span>{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 pt-3 space-y-1">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          {order.shippingCost > 0 ? (
            <div className="flex justify-between text-sm text-gray-500">
              <span>Frete{order.shippingMethod ? ` (${order.shippingMethod})` : ""}</span>
              <span>{formatCurrency(order.shippingCost)}</span>
            </div>
          ) : (
            <div className="flex justify-between text-sm text-gray-400">
              <span>Frete</span>
              <span>A combinar</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>

        <div className="border-t border-gray-100 mt-4 pt-4">
          <h3 className="font-semibold text-gray-900 mb-2">Dados do cliente</h3>
          <p className="text-sm text-gray-700">{order.customerName}</p>
          <p className="text-sm text-gray-500">{order.customerPhone}</p>
          {order.customerEmail && <p className="text-sm text-gray-500">{order.customerEmail}</p>}
          {order.address && <p className="text-sm text-gray-500">{order.address}</p>}
        </div>
      </div>

      <Link href="/produtos" className="bg-brand text-white px-8 py-3 rounded-full font-semibold hover:opacity-90 transition-colors">
        Continuar comprando
      </Link>
    </div>
  );
}
