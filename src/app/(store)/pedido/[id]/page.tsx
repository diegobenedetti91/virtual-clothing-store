"use client";

import { useEffect, useState } from "react";
import OptimizedImg from "@/components/OptimizedImg";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, Clock, Copy, CreditCard, Download, ExternalLink, FileText, Loader2, MapPin, MessageCircle,
  Package, PackageCheck, Store, Tag, Truck, Undo2, User, XCircle,
} from "lucide-react";
import { formatCurrency, ORDER_STATUS } from "@/lib/utils";
import { getCarrierTracking } from "@/lib/carrierTracking";
import { attributesLabel } from "@/lib/variantUtils";
import ReturnRequestModal from "@/components/ReturnRequestModal";

interface Item {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  size?: string | null;
  color?: string | null;
  selectedAttributes?: string | null;
  product: { id: string; name: string; images: string; slug: string };
}
interface ReturnInfo { id: string; status: string; createdAt: string; trackingCode: string | null; refundAmount: number; refundedAt: string | null }
interface Order {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  cpfCnpj: string | null;
  address: string | null;
  streetNumber: string | null;
  neighborhood: string | null;
  zipCode: string | null;
  subtotal: number;
  shippingCost: number;
  shippingMethod: string | null;
  total: number;
  couponCode: string | null;
  couponDiscount: number;
  creditUsed?: number;
  cashbackEarned?: number;
  paymentMethod: string | null;
  cancelReason: string | null;
  nfeStatus: string | null;
  nfeNumero: string | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  shipmentStatus: string | null;
  lastTrackingUpdate: string | null;
  items: Item[];
  returns: ReturnInfo[];
  trackingEvents: { status: string; location: string | null; timestamp: string }[];
  canCancel: boolean;
  canReturn: boolean;
  returnDaysLeft: number;
  returnDeadline: string | null;
}

const SHIPMENT_LABEL: Record<string, string> = {
  posted: "Etiqueta criada — aguardando a transportadora coletar",
  in_transit: "Em trânsito",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  exception: "Problema na entrega — fale com a loja",
};
const RETURN_LABEL: Record<string, { text: string; tone: string }> = {
  PENDING: { text: "Devolução solicitada — a loja vai enviar o código de postagem por e-mail", tone: "bg-amber-50 text-amber-800" },
  AWAITING_RETURN: { text: "Código de postagem enviado — leve a peça a uma agência", tone: "bg-blue-50 text-blue-800" },
  APPROVED: { text: "Devolução aprovada", tone: "bg-emerald-50 text-emerald-800" },
  REJECTED: { text: "Devolução recusada — veja o motivo no seu e-mail", tone: "bg-red-50 text-red-800" },
};
const CANCEL_REASONS = ["Desisti da compra", "Comprei o tamanho/cor errado", "Encontrei mais barato", "Demora na entrega", "Outro motivo"];

function Card({ title, icon: Icon, children, className = "" }: { title: string; icon: React.ComponentType<{ size?: number; className?: string }>; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>
      <header className="flex items-center gap-2 px-5 pt-4 pb-3">
        <Icon size={16} className="text-gray-400" />
        <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

export default function CustomerOrderPage() {
  const { id } = useParams() as { id: string };
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/customer/orders/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Pedido não encontrado");
        return data;
      })
      .then((d) => !cancelled && setOrder(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Erro ao carregar"));
    fetch("/api/settings").then((r) => r.json()).then((s) => !cancelled && setWhatsapp(s?.whatsapp || null)).catch(() => {});
    return () => { cancelled = true; };
  }, [id, reload]);

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-4">
        <XCircle size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="font-medium text-gray-800">{error}</p>
        <Link href="/conta?tab=orders" className="inline-flex items-center gap-1 mt-4 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft size={14} /> Meus pedidos</Link>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-4">
        <div className="img-skeleton rounded-2xl h-40" />
        <div className="grid lg:grid-cols-3 gap-4"><div className="img-skeleton rounded-2xl h-72 lg:col-span-2" /><div className="img-skeleton rounded-2xl h-72" /></div>
      </div>
    );
  }

  const status = ORDER_STATUS[order.status] || { label: order.status, color: "bg-gray-100 text-gray-700" };
  const isPickup = order.shippingMethod === "retirada";
  const stepIndex =
    order.status === "PENDING" ? 0
      : order.status === "CONFIRMED" ? 1
        : order.status === "SHIPPED" || order.status === "PRONTO_PARA_RETIRADA" ? 2
          : order.status === "DELIVERED" || order.status === "RETIRADO" ? 3 : -1;
  const steps = ["Pedido feito", "Pagamento aprovado", isPickup ? "Pronto para retirada" : "Enviado", isPickup ? "Retirado" : "Entregue"];
  const headline: Record<string, string> = {
    PENDING: "Aguardando a confirmação do pagamento",
    CONFIRMED: isPickup ? "Pagamento aprovado! Estamos separando seu pedido" : "Pagamento aprovado! Estamos preparando o envio",
    SHIPPED: "Seu pedido está a caminho",
    PRONTO_PARA_RETIRADA: "Seu pedido está pronto para retirada",
    DELIVERED: "Pedido entregue. Aproveite!",
    RETIRADO: "Pedido retirado. Aproveite!",
    CANCELLED: "Pedido cancelado",
  };
  const couponDiscount = order.couponDiscount || 0;
  const creditUsed = order.creditUsed || 0;
  const pixDiscount = Math.max(0, Math.round((order.subtotal + order.shippingCost - order.total - couponDiscount - creditUsed) * 100) / 100);
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const tracking = order.trackingCode ? getCarrierTracking(order.trackingCode) : null;
  const trackUrl = order.trackingUrl || tracking?.url;
  const lastReturn = order.returns[0];
  const waDigits = (whatsapp || "").replace(/\D/g, "");
  const waLink = waDigits
    ? `https://wa.me/${waDigits.length <= 11 ? "55" : ""}${waDigits}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre o meu pedido ${order.orderNumber}.`)}`
    : null;

  return (
    <div className="bg-gray-50/80 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10 space-y-5">
        <Link href="/conta?tab=orders" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft size={15} /> Meus pedidos</Link>

        {notice && (
          <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${notice.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
            {notice.ok ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
            {notice.text}
          </div>
        )}

        {/* Cabeçalho */}
        <div className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">Pedido {order.orderNumber}</h1>
                <button onClick={() => copy(order.orderNumber, "num")} className="p-1 rounded-md text-gray-400 hover:text-gray-700" aria-label="Copiar número do pedido">
                  {copied === "num" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.color}`}>{status.label}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(order.createdAt).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })} · {itemCount} {itemCount === 1 ? "peça" : "peças"}
              </p>
              <p className="text-base font-medium text-gray-900 mt-3">{headline[order.status] || status.label}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-3xl font-semibold tracking-tight text-gray-900 tabular-nums">{formatCurrency(order.total)}</p>
              {order.paymentMethod && <p className="text-xs text-gray-500 mt-0.5">{order.paymentMethod}</p>}
            </div>
          </div>

          {stepIndex >= 0 ? (
            <ol className="mt-6 grid grid-cols-4">
              {steps.map((s, i) => {
                const done = i <= stepIndex;
                const current = i === stepIndex;
                return (
                  <li key={s} className="relative flex flex-col items-center text-center">
                    {i > 0 && <span className={`absolute top-3.5 right-1/2 w-full h-0.5 ${i <= stepIndex ? "bg-brand" : "bg-gray-200"}`} />}
                    <span className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${done ? "bg-brand text-on-button" : "bg-white text-gray-400 ring-2 ring-gray-200"} ${current ? "ring-4 ring-[color-mix(in_srgb,var(--brand)_25%,transparent)]" : ""}`}>
                      {done ? <Check size={14} /> : i + 1}
                    </span>
                    <span className={`mt-1.5 text-[11px] sm:text-xs leading-tight ${current ? "font-semibold text-gray-900" : done ? "text-gray-700" : "text-gray-400"}`}>{s}</span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 text-red-800 px-4 py-3 text-sm">
              <XCircle size={16} className="shrink-0 mt-0.5" />
              <span>Este pedido foi cancelado{order.cancelReason ? ` — ${order.cancelReason}` : ""}. Se houve pagamento, o estorno é feito na mesma forma de pagamento.</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Entrega */}
            <Card title={isPickup ? "Retirada" : "Entrega"} icon={isPickup ? Store : Truck}>
              {isPickup ? (
                <div className="flex items-start gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  <Store size={18} className="text-gray-500 shrink-0 mt-0.5" />
                  {order.status === "PRONTO_PARA_RETIRADA"
                    ? "Seu pedido já pode ser retirado na loja. Leve um documento com foto."
                    : order.status === "RETIRADO" ? "Pedido retirado na loja." : "Avisaremos por e-mail quando estiver pronto para retirada."}
                </div>
              ) : order.trackingCode ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-emerald-50 px-4 py-3 flex items-start gap-3">
                    <PackageCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-emerald-800">{SHIPMENT_LABEL[order.shipmentStatus || ""] || "Pedido enviado"}</p>
                      {order.lastTrackingUpdate && <p className="text-xs text-emerald-700 mt-0.5">Atualizado em {new Date(order.lastTrackingUpdate).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>}
                    </div>
                  </div>
                  <div className="rounded-xl ring-1 ring-gray-100 px-3 py-2.5">
                    <p className="text-xs text-gray-500">Código de rastreio</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-mono font-semibold text-gray-900">{order.trackingCode}</span>
                      {tracking?.carrier && <span className="text-xs text-gray-400">{tracking.carrier}</span>}
                      <button onClick={() => copy(order.trackingCode!, "trk")} className="ml-auto p-1 text-gray-400 hover:text-gray-700" aria-label="Copiar código de rastreio">
                        {copied === "trk" ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                  {order.trackingEvents.length > 0 && (
                    <ol className="relative ml-2 border-l-2 border-gray-100 space-y-3 py-1">
                      {order.trackingEvents.map((e, i) => (
                        <li key={i} className="pl-4 relative">
                          <span className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full ring-2 ring-white ${i === 0 ? "bg-brand" : "bg-gray-300"}`} />
                          <p className={`text-sm ${i === 0 ? "font-medium text-gray-900" : "text-gray-600"}`}>{e.status}</p>
                          <p className="text-xs text-gray-400">{new Date(e.timestamp).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}{e.location ? ` · ${e.location}` : ""}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/pedido/${order.id}/rastreamento`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-on-button hover:bg-brand-hover text-sm font-semibold">
                      <Truck size={15} /> Ver rastreamento completo
                    </Link>
                    {trackUrl && (
                      <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl ring-1 ring-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        <ExternalLink size={15} /> Site da transportadora
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  <Clock size={18} className="text-gray-400 shrink-0 mt-0.5" />
                  {order.status === "CANCELLED"
                    ? "Este pedido não será enviado."
                    : order.status === "PENDING"
                      ? "Assim que o pagamento for aprovado, preparamos o envio."
                      : "Estamos preparando seu pedido. Você recebe o código de rastreio por e-mail assim que ele for postado."}
                </div>
              )}
            </Card>

            {/* Itens */}
            <Card title={`Itens (${itemCount})`} icon={Package}>
              <ul className="divide-y divide-gray-100 -mt-1">
                {order.items.map((item) => {
                  let image: string | null = null;
                  try { const imgs = JSON.parse(item.product?.images || "[]"); image = Array.isArray(imgs) ? imgs[0] ?? null : null; } catch {}
                  let variant = "";
                  try {
                    const attrs = item.selectedAttributes ? JSON.parse(item.selectedAttributes) : null;
                    variant = attrs && Object.keys(attrs).length ? attributesLabel(attrs) : [item.size && `Tamanho: ${item.size}`, item.color && `Cor: ${item.color}`].filter(Boolean).join(" / ");
                  } catch { variant = [item.size, item.color].filter(Boolean).join(" / "); }
                  return (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <Link href={item.product?.slug ? `/produtos/${item.product.slug}` : "#"} className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                        {image ? <OptimizedImg src={image} widths={[160]} sizes="64px" alt="" className="w-full h-full object-cover" /> : <Package size={18} className="m-auto mt-5 text-gray-400" />}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link href={item.product?.slug ? `/produtos/${item.product.slug}` : "#"} className="text-sm font-medium text-gray-900 hover:text-brand line-clamp-2">{item.product?.name}</Link>
                        {variant && <p className="text-xs text-gray-500">{variant}</p>}
                        <p className="text-xs text-gray-400 tabular-nums">{item.quantity} × {formatCurrency(item.price)}</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(item.price * item.quantity)}</p>
                    </li>
                  );
                })}
              </ul>
              <dl className="mt-2 pt-3 border-t border-gray-100 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600"><dt>Subtotal</dt><dd className="tabular-nums">{formatCurrency(order.subtotal)}</dd></div>
                <div className="flex justify-between text-gray-600"><dt>Frete</dt><dd className="tabular-nums">{order.shippingCost > 0 ? formatCurrency(order.shippingCost) : isPickup ? "Retirada" : "Grátis"}</dd></div>
                {couponDiscount > 0 && <div className="flex justify-between text-emerald-700"><dt className="inline-flex items-center gap-1"><Tag size={13} /> Cupom {order.couponCode}</dt><dd className="tabular-nums">−{formatCurrency(couponDiscount)}</dd></div>}
                {pixDiscount > 0 && <div className="flex justify-between text-emerald-700"><dt>Desconto Pix</dt><dd className="tabular-nums">−{formatCurrency(pixDiscount)}</dd></div>}
                {creditUsed > 0 && <div className="flex justify-between text-brand"><dt>Seu crédito (cashback)</dt><dd className="tabular-nums">−{formatCurrency(creditUsed)}</dd></div>}
                <div className="flex justify-between font-semibold text-gray-900 text-base pt-1.5 border-t border-gray-100"><dt>Total</dt><dd className="tabular-nums">{formatCurrency(order.total)}</dd></div>
                {(order.cashbackEarned || 0) > 0 && order.status !== "CANCELLED" && (
                  <Link href="/conta?tab=credito" className="mt-1 flex justify-between items-center rounded-lg bg-brand-light px-2.5 py-1.5 text-[12.5px] text-brand hover:bg-brand-muted">
                    <span>🎁 Cashback desta compra (libera após a entrega)</span>
                    <b className="tabular-nums">+{formatCurrency(order.cashbackEarned!)}</b>
                  </Link>
                )}
              </dl>
            </Card>
          </div>

          {/* Lateral */}
          <div className="space-y-5">
            {/* Ajuda */}
            <Card title="Precisa de ajuda?" icon={MessageCircle}>
              <p className="text-sm text-gray-600">Fale com a loja sobre este pedido. A mensagem já vai com o número do pedido.</p>
              {waLink ? (
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex w-full items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:brightness-95">
                  <MessageCircle size={15} /> Falar com a loja no WhatsApp
                </a>
              ) : (
                <p className="mt-2 text-xs text-gray-400">Responda o e-mail de confirmação do pedido para falar com a loja.</p>
              )}
            </Card>

            {/* Ações do pedido */}
            {(order.canCancel || order.canReturn || lastReturn) && (
              <Card title={lastReturn ? "Devolução" : order.canCancel ? "Mudou de ideia?" : "Devolução"} icon={Undo2}>
                {lastReturn && (
                  <div className={`rounded-xl px-3 py-2.5 text-sm ${RETURN_LABEL[lastReturn.status]?.tone || "bg-gray-50 text-gray-700"}`}>
                    <p className="font-medium">{RETURN_LABEL[lastReturn.status]?.text || lastReturn.status}</p>
                    {lastReturn.trackingCode && lastReturn.status === "AWAITING_RETURN" && (
                      <p className="mt-1 text-xs">Código de postagem: <span className="font-mono font-semibold">{lastReturn.trackingCode}</span></p>
                    )}
                    {lastReturn.status === "APPROVED" && lastReturn.refundAmount > 0 && (
                      <p className="mt-1 text-xs">Estorno de {formatCurrency(lastReturn.refundAmount)}{lastReturn.refundedAt ? " realizado" : " em processamento"}.</p>
                    )}
                  </div>
                )}
                {order.canCancel && (
                  <>
                    <p className="text-sm text-gray-600">Seu pedido ainda não foi enviado. Você pode cancelar e o valor é estornado na mesma forma de pagamento.</p>
                    <button onClick={() => setCancelOpen(true)} className="mt-3 w-full px-3 py-2.5 rounded-xl ring-1 ring-red-200 text-red-700 text-sm font-semibold hover:bg-red-50">Cancelar pedido</button>
                  </>
                )}
                {order.canReturn && (
                  <div className={lastReturn ? "mt-3" : ""}>
                    <p className="text-sm text-gray-600">
                      Não serviu ou não gostou? Você pode pedir a devolução até{" "}
                      <b>{order.returnDeadline ? new Date(order.returnDeadline).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) : ""}</b>
                      {" "}({order.returnDaysLeft} dia{order.returnDaysLeft === 1 ? "" : "s"}) — o prazo de 7 dias conta a partir do recebimento.
                    </p>
                    <button onClick={() => setReturnOpen(true)} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-brand text-on-button hover:bg-brand-hover text-sm font-semibold">
                      <Undo2 size={15} /> Solicitar devolução
                    </button>
                  </div>
                )}
              </Card>
            )}

            {(order.address || order.zipCode) && !isPickup && (
              <Card title="Endereço de entrega" icon={MapPin}>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {order.customerName}
                  <br />
                  {order.address}{order.streetNumber && !order.address?.includes(order.streetNumber) ? `, ${order.streetNumber}` : ""}
                  {order.neighborhood && !order.address?.includes(order.neighborhood) && <><br />{order.neighborhood}</>}
                  {order.zipCode && !order.address?.includes(order.zipCode) && <><br />CEP {order.zipCode}</>}
                </p>
              </Card>
            )}

            <Card title="Pagamento" icon={CreditCard}>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Forma</dt><dd className="text-gray-900 text-right">{order.paymentMethod || "A combinar"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Situação</dt><dd className="text-gray-900">{order.status === "PENDING" ? "Aguardando" : order.status === "CANCELLED" ? "Cancelado" : "Aprovado"}</dd></div>
              </dl>
              {order.nfeStatus === "authorized" && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5"><FileText size={13} /> Nota fiscal{order.nfeNumero ? ` nº ${order.nfeNumero}` : ""}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <a href={`/api/customer/orders/${order.id}/nfe?formato=pdf`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-brand text-on-button text-xs font-semibold hover:bg-brand-hover">
                      <Download size={14} /> Baixar PDF
                    </a>
                    <a href={`/api/customer/orders/${order.id}/nfe?formato=xml`} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50">
                      <Download size={14} /> XML
                    </a>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Seus dados" icon={User}>
              <p className="text-sm font-medium text-gray-900">{order.customerName}</p>
              <div className="mt-1 space-y-0.5 text-xs text-gray-500">
                {order.customerEmail && <p className="break-all">{order.customerEmail}</p>}
                <p>{order.customerPhone}</p>
                {order.cpfCnpj && <p>CPF/CNPJ {order.cpfCnpj}</p>}
              </div>
            </Card>
          </div>
        </div>

        <div className="text-center pt-2">
          <Link href="/produtos" className="inline-flex items-center gap-2 bg-brand text-on-button px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90">Continuar comprando</Link>
        </div>
      </div>

      <ReturnRequestModal
        orderId={order.id}
        orderNumber={order.orderNumber}
        items={order.items}
        isOpen={returnOpen}
        onClose={() => setReturnOpen(false)}
        onSuccess={() => { setReturnOpen(false); setNotice({ ok: true, text: "Devolução solicitada! Você vai receber as instruções por e-mail." }); setReload((n) => n + 1); }}
      />
      {cancelOpen && (
        <CancelDialog
          orderNumber={order.orderNumber}
          onClose={() => setCancelOpen(false)}
          onDone={(ok, text) => { setCancelOpen(false); setNotice({ ok, text }); if (ok) setReload((n) => n + 1); }}
        />
      )}
    </div>
  );
}

function CancelDialog({ orderNumber, onClose, onDone }: { orderNumber: string; onClose: () => void; onDone: (ok: boolean, text: string) => void }) {
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, reason: reason === "Outro motivo" ? other.trim() || "Outro motivo" : reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível cancelar");
      onDone(true, data.message || "Pedido cancelado. O estorno é feito na mesma forma de pagamento.");
    } catch (e) {
      onDone(false, e instanceof Error ? e.message : "Não foi possível cancelar");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 animate-fade-up [animation-duration:0.25s]">
        <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4"><XCircle size={22} /></div>
        <h3 className="text-lg font-semibold text-gray-900">Cancelar o pedido {orderNumber}?</h3>
        <p className="text-sm text-gray-500 mt-1">O valor pago é estornado na mesma forma de pagamento. Essa ação não pode ser desfeita.</p>
        <p className="mt-4 text-xs font-medium text-gray-600 mb-1.5">Conta pra gente o motivo</p>
        <div className="space-y-1.5">
          {CANCEL_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className={`w-full text-left text-sm px-3 py-2 rounded-xl ring-1 transition ${reason === r ? "ring-2 ring-red-400 bg-red-50 text-red-800" : "ring-gray-200 text-gray-700 hover:bg-gray-50"}`}>{r}</button>
          ))}
        </div>
        {reason === "Outro motivo" && <input autoFocus value={other} onChange={(e) => setOther(e.target.value)} placeholder="Escreva o motivo" className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100">Manter pedido</button>
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">
            {busy && <Loader2 size={14} className="animate-spin" />} Cancelar pedido
          </button>
        </div>
      </div>
    </div>
  );
}
