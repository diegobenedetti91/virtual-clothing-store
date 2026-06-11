"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, MessageCircle, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CompanySettings } from "@/types";
import { useCart } from "@/hooks/useCart";
import { useCustomer } from "@/hooks/useCustomer";

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  size?: string | null;
  color?: string | null;
  product: { name: string };
}

interface Order {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  notes?: string | null;
  total: number;
  items: OrderItem[];
}

function buildWhatsAppMessage(order: Order, storeName: string): string {
  const itemLines = order.items
    .map((item) => {
      const variation = [item.size && `Tam: ${item.size}`, item.color && `Cor: ${item.color}`]
        .filter(Boolean).join(", ");
      return `• ${item.product.name}${variation ? ` (${variation})` : ""} - ${item.quantity}× ${formatCurrency(item.price)} = ${formatCurrency(item.price * item.quantity)}`;
    })
    .join("\n");

  const lines = [
    `🛍️ *NOVO PEDIDO - ${storeName}*`,
    ``,
    `📋 *Nº do pedido:* ${order.orderNumber}`,
    `👤 *Cliente:* ${order.customerName}`,
    `📱 *Telefone:* ${order.customerPhone}`,
    ...(order.customerEmail ? [`📧 *E-mail:* ${order.customerEmail}`] : []),
    ...(order.address ? [
      ``,
      `📍 *Endereço de entrega:*`,
      `   ${order.address}`,
      ...(order.zipCode ? [`   CEP: ${order.zipCode}`] : []),
    ] : []),
    ``,
    `*Produtos:*`,
    itemLines,
    ``,
    `💰 *Total:* ${formatCurrency(order.total)}`,
    `🚚 *Frete:* A combinar`,
    ...(order.notes ? [``, `📝 *Observações:* ${order.notes}`] : []),
    ``,
    `✅ *Pagamento confirmado via Mercado Pago*`,
    ``,
    `_Pedido gerado em ${new Date().toLocaleString("pt-BR")}_`,
  ];

  return lines.join("\n");
}

export default function CheckoutSucessoPage() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order");
  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [waOpened, setWaOpened] = useState(false);
  const hasSent = useRef(false);

  // Clear cart on successful payment
  const { clearCart } = useCart();
  const customer = useCustomer((s) => s.customer);
  
  useEffect(() => {
    if (orderNumber && order) {
      clearCart();
      // Save empty cart to backend
      const email = customer?.email || order.customerEmail;
      if (email) {
        fetch(`/api/cart/save?email=${encodeURIComponent(email)}`, { method: "DELETE" }).catch(() => {});
      }
    }
  }, [orderNumber, order, clearCart, customer?.email]);

  useEffect(() => {
    if (!orderNumber) { setLoading(false); return; }
    Promise.all([
      fetch(`/api/orders?search=${encodeURIComponent(orderNumber)}`).then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([ordersData, settingsData]) => {
      const found = Array.isArray(ordersData) ? ordersData[0] : null;
      setOrder(found || null);
      setSettings(settingsData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [orderNumber]);

  useEffect(() => {
    if (!order || !settings || hasSent.current) return;
    const whatsapp = settings.whatsapp?.replace(/\D/g, "") || "";
    if (!whatsapp) return;
    hasSent.current = true;
    const message = buildWhatsAppMessage(order, settings.name || "Minha Loja");
    const url = `https://api.whatsapp.com/send?phone=${whatsapp}&text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    setWaOpened(true);
  }, [order, settings]);

  const handleManualWA = () => {
    if (!order || !settings) return;
    const whatsapp = settings.whatsapp?.replace(/\D/g, "") || "";
    const message = buildWhatsAppMessage(order, settings.name || "Minha Loja");
    const url = `https://api.whatsapp.com/send?${whatsapp ? `phone=${whatsapp}&` : ""}text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    setWaOpened(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">Pedido confirmado!</h1>
        {orderNumber && (
          <p className="text-sm text-gray-500 mb-1">
            Pedido: <span className="font-bold text-gray-800">{orderNumber}</span>
          </p>
        )}
        <p className="text-gray-500 text-sm mb-6">
          Pagamento aprovado. Você receberá um e-mail de confirmação em breve. Assim que seu pedido for preparado e enviado, avisaremos por e-mail.
        </p>

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mb-6">
            <Loader2 size={16} className="animate-spin" />
            Carregando detalhes...
          </div>
        ) : order && settings?.whatsapp ? (
          <div className={`rounded-2xl p-4 mb-6 text-sm ${waOpened ? "bg-green-50 border border-green-100 text-green-800" : "bg-amber-50 border border-amber-100 text-amber-800"}`}>
            {waOpened ? (
              <p className="font-semibold flex items-center justify-center gap-2">
                <MessageCircle size={16} /> Detalhes do pedido enviados pelo WhatsApp!
              </p>
            ) : (
              <>
                <p className="font-semibold mb-2">O WhatsApp não abriu automaticamente?</p>
                <button
                  onClick={handleManualWA}
                  className="inline-flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-green-700 transition-colors text-sm"
                >
                  <MessageCircle size={16} /> Enviar pelo WhatsApp
                </button>
              </>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <Link
            href="/conta"
            className="w-full py-3 bg-brand text-white rounded-xl font-bold hover:opacity-90 transition-colors text-sm"
          >
            Ver meus pedidos
          </Link>
          <Link
            href="/produtos"
            className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm"
          >
            Continuar comprando
          </Link>
        </div>
      </div>
    </div>
  );
}
