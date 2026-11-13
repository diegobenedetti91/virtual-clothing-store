"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, Clock, Copy, CreditCard, ExternalLink, FileText, Globe, Loader2, Mail,
  MapPin, MessageCircle, Package, PackageCheck, Phone, RefreshCw, Receipt, Store, Tag, Truck, User, XCircle,
} from "lucide-react";
import { formatCurrency, needsMelhorEnvioLabel, ORDER_STATUS } from "@/lib/utils";
import { getCarrierTracking } from "@/lib/carrierTracking";
import { attributesLabel } from "@/lib/variantUtils";

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  size?: string | null;
  color?: string | null;
  selectedAttributes?: string | null;
  product?: { name: string; images?: string | null; slug?: string } | null;
}

interface OrderDetails {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  cpfCnpj?: string | null;
  address?: string | null;
  streetNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  status: string;
  subtotal: number;
  shippingCost: number;
  total: number;
  couponCode?: string | null;
  couponDiscount?: number;
  paymentMethod?: string | null;
  paymentGateway?: string | null;
  paymentId?: string | null;
  paymentFee?: number;
  notes?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  melhorEnvioShipmentId?: string | null;
  trackingCode?: string | null;
  trackingUrl?: string | null;
  etiquetaUrl?: string | null;
  shipmentStatus?: string | null;
  labelValid?: boolean | null;
  labelError?: string | null;
  shippingMethod?: string | null;
  shipmentRetryError?: string | null;
  shipmentAttempts?: number;
  blingIntegrationStatus?: string | null;
  blingPedidoId?: string | null;
  blingIntegratedAt?: string | null;
  trafficChannel?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}

type Msg = { type: "success" | "error"; text: string } | null;

const SHIPMENT_STATUS: Record<string, string> = {
  posted: "Etiqueta criada · aguardando coleta",
  in_transit: "Em trânsito",
  delivered: "Entregue",
  cancelled: "Cancelada",
  exception: "Problema na entrega",
  pending: "Pendente",
};

function Card({ title, icon: Icon, action, children, className = "" }: { title: string; icon: React.ComponentType<{ size?: number; className?: string }>; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>
      <header className="flex items-center gap-2 px-5 pt-4 pb-3">
        <Icon size={16} className="text-gray-400" />
        <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
        <div className="ml-auto">{action}</div>
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

function Note({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p className={`mt-3 flex items-start gap-2 text-sm rounded-xl px-3 py-2.5 ${msg.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
      {msg.type === "success" ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
      <span className="break-words">{msg.text}</span>
    </p>
  );
}

export default function OrderDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blingEnabled, setBlingEnabled] = useState(false);
  const [labelBusy, setLabelBusy] = useState(false);
  const [labelMsg, setLabelMsg] = useState<Msg>(null);
  const [blingBusy, setBlingBusy] = useState(false);
  const [blingMsg, setBlingMsg] = useState<Msg>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/api/orders/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Pedido não encontrado");
        return res.json();
      })
      .then((data) => !cancelled && setOrder(data))
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : "Erro ao carregar pedido"));
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => !cancelled && setBlingEnabled(!!s?.blingAtivo))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const generateLabel = async () => {
    if (!order) return;
    setLabelBusy(true);
    setLabelMsg(null);
    try {
      const res = await fetch("/api/admin/shipment-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (data.success) {
        setOrder({ ...order, ...data });
        setLabelMsg({ type: "success", text: data.message || "Etiqueta criada" });
      } else {
        const text = data.error || data.message || "Erro ao gerar etiqueta";
        setOrder({ ...order, shipmentRetryError: text });
        setLabelMsg({ type: "error", text });
      }
    } catch {
      setLabelMsg({ type: "error", text: "Erro ao gerar etiqueta" });
    } finally {
      setLabelBusy(false);
    }
  };

  const sendToBling = async () => {
    if (!order) return;
    setBlingBusy(true);
    setBlingMsg(null);
    try {
      const res = await fetch("/api/admin/pedidos/bling-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrder({ ...order, blingIntegrationStatus: "success", blingPedidoId: data.blingId, blingIntegratedAt: new Date().toISOString() });
        setBlingMsg({ type: "success", text: `Pedido enviado ao Bling (ID ${data.blingId})` });
      } else {
        setOrder({ ...order, blingIntegrationStatus: "error" });
        setBlingMsg({ type: "error", text: data.error || "Erro ao enviar ao Bling" });
      }
    } catch {
      setBlingMsg({ type: "error", text: "Erro ao chamar a API" });
    } finally {
      setBlingBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <XCircle size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="font-medium text-gray-800">{loadError}</p>
        <Link href="/admin/pedidos" className="inline-flex items-center gap-1 mt-4 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft size={14} /> Voltar para pedidos</Link>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="space-y-4">
        <div className="img-skeleton rounded-2xl h-28" />
        <div className="grid lg:grid-cols-3 gap-4"><div className="img-skeleton rounded-2xl h-80 lg:col-span-2" /><div className="img-skeleton rounded-2xl h-80" /></div>
      </div>
    );
  }

  const status = ORDER_STATUS[order.status] || { label: order.status, color: "bg-gray-100 text-gray-700" };
  const isPaid = !["PENDING", "CANCELLED"].includes(order.status);
  const usesLabel = needsMelhorEnvioLabel(order.shippingMethod);
  const isPickup = order.shippingMethod === "retirada";
  const blingOk = order.blingIntegrationStatus === "success" && !!order.blingPedidoId;
  const couponDiscount = order.couponDiscount || 0;
  const otherDiscount = Math.max(0, Math.round((order.subtotal + order.shippingCost - order.total - couponDiscount) * 100) / 100);
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const phoneDigits = order.customerPhone.replace(/\D/g, "");
  const tracking = order.trackingCode ? getCarrierTracking(order.trackingCode) : null;

  // Linha do tempo
  const finalLabel = isPickup ? "Retirado" : "Entregue";
  const middleLabel = isPickup ? "Pronto p/ retirada" : "Enviado";
  const stepIndex =
    order.status === "PENDING" ? 0
      : order.status === "CONFIRMED" ? 1
        : order.status === "SHIPPED" || order.status === "PRONTO_PARA_RETIRADA" ? 2
          : order.status === "DELIVERED" || order.status === "RETIRADO" ? 3 : -1;
  const steps = ["Pedido feito", "Pago", middleLabel, finalLabel];

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <Link href="/admin/pedidos" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 mb-2"><ArrowLeft size={13} /> Pedidos</Link>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{order.orderNumber}</h1>
              <button onClick={() => copy(order.orderNumber, "num")} className="p-1 rounded-md text-gray-400 hover:text-gray-700" aria-label="Copiar número">
                {copied === "num" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.color}`}>{status.label}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(order.createdAt).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })} · {itemCount} {itemCount === 1 ? "peça" : "peças"}
            </p>
          </div>
          <div className="md:text-right">
            <p className="text-xs text-gray-500">Total pago</p>
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
                  {i > 0 && <span className={`absolute top-3.5 right-1/2 w-full h-0.5 -z-0 ${i <= stepIndex ? "bg-brand" : "bg-gray-200"}`} />}
                  <span className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition ${done ? "bg-brand text-white" : "bg-white text-gray-400 ring-2 ring-gray-200"} ${current ? "ring-4 ring-[color-mix(in_srgb,var(--brand)_25%,transparent)]" : ""}`}>
                    {done ? <Check size={14} /> : i + 1}
                  </span>
                  <span className={`mt-1.5 text-[11px] sm:text-xs ${current ? "font-semibold text-gray-900" : done ? "text-gray-700" : "text-gray-400"}`}>{s}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 text-red-800 px-4 py-3 text-sm">
            <XCircle size={16} className="shrink-0 mt-0.5" />
            <span>Pedido cancelado{order.cancelReason ? ` — ${order.cancelReason}` : ""}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-5">
          {/* Etiqueta */}
          <Card title="Entrega e etiqueta" icon={Truck}>
            {!usesLabel ? (
              <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
                {isPickup ? <Store size={18} className="text-gray-500" /> : <Truck size={18} className="text-gray-500" />}
                <p className="text-sm text-gray-700">{isPickup ? "Retirada na loja" : order.shippingMethod === "local" ? "Entrega local" : "Entrega a combinar"} — não usa etiqueta.</p>
              </div>
            ) : order.melhorEnvioShipmentId ? (
              <div className="space-y-3">
                <div className={`rounded-xl px-4 py-3 flex items-start gap-3 ${order.labelValid === false ? "bg-red-50" : "bg-emerald-50"}`}>
                  {order.labelValid === false ? <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" /> : <PackageCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${order.labelValid === false ? "text-red-800" : "text-emerald-800"}`}>
                      {order.labelValid === false ? "Etiqueta inválida — precisa ser recriada" : SHIPMENT_STATUS[order.shipmentStatus || ""] || "Etiqueta criada"}
                    </p>
                    {order.labelError && <p className="text-xs text-red-700 mt-0.5 break-words">{order.labelError}</p>}
                  </div>
                </div>
                <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl ring-1 ring-gray-100 px-3 py-2.5">
                    <dt className="text-xs text-gray-500">Código de rastreio</dt>
                    <dd className="mt-0.5 flex items-center gap-2">
                      {order.trackingCode ? (
                        <>
                          <a href={order.trackingUrl || tracking?.url} target="_blank" rel="noopener noreferrer" className="font-mono font-semibold text-gray-900 hover:underline">{order.trackingCode}</a>
                          {tracking?.carrier && <span className="text-xs text-gray-400">{tracking.carrier}</span>}
                          <button onClick={() => copy(order.trackingCode!, "trk")} className="ml-auto p-1 text-gray-400 hover:text-gray-700" aria-label="Copiar rastreio">
                            {copied === "trk" ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          </button>
                        </>
                      ) : <span className="text-gray-400">Ainda não gerado pela transportadora</span>}
                    </dd>
                  </div>
                  <div className="rounded-xl ring-1 ring-gray-100 px-3 py-2.5 min-w-0">
                    <dt className="text-xs text-gray-500">ID no Melhor Envio</dt>
                    <dd className="mt-0.5 font-mono text-xs text-gray-700 truncate" title={order.melhorEnvioShipmentId}>{order.melhorEnvioShipmentId}</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2">
                  {order.etiquetaUrl && (
                    <a href={order.etiquetaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800">
                      <FileText size={15} /> Imprimir etiqueta
                    </a>
                  )}
                  {order.trackingCode && (
                    <a href={order.trackingUrl || tracking?.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl ring-1 ring-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      <ExternalLink size={15} /> Rastrear
                    </a>
                  )}
                  {order.labelValid === false && isPaid && (
                    <button onClick={generateLabel} disabled={labelBusy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50">
                      {labelBusy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Recriar etiqueta
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className={`rounded-xl px-4 py-4 ${order.shipmentRetryError ? "bg-red-50" : "bg-amber-50"}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className={`${order.shipmentRetryError ? "text-red-600" : "text-amber-600"} shrink-0 mt-0.5`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${order.shipmentRetryError ? "text-red-800" : "text-amber-800"}`}>
                      {order.shipmentRetryError ? "A geração da etiqueta falhou" : isPaid ? "Pedido pago sem etiqueta" : "A etiqueta é gerada quando o pagamento for aprovado"}
                    </p>
                    {order.shipmentRetryError && (
                      <p className="text-xs text-red-700 mt-1 break-words">
                        {order.shipmentRetryError}
                        {order.shipmentAttempts ? <span className="text-red-500"> · {order.shipmentAttempts} tentativa(s)</span> : null}
                      </p>
                    )}
                    {order.shipmentRetryError && <p className="text-xs text-gray-600 mt-2">Corrija a causa (saldo no Melhor Envio, CEP ou endereço) e gere de novo.</p>}
                  </div>
                </div>
                {isPaid && (
                  <button onClick={generateLabel} disabled={labelBusy} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50">
                    {labelBusy ? <Loader2 size={15} className="animate-spin" /> : <Package size={15} />} {labelBusy ? "Gerando…" : "Gerar etiqueta"}
                  </button>
                )}
              </div>
            )}
            <Note msg={labelMsg} />
          </Card>

          {/* Bling */}
          {blingEnabled && (
            <Card title="Bling (nota e estoque)" icon={Receipt}>
              {blingOk ? (
                <div className="flex items-start gap-3 rounded-xl bg-emerald-50 px-4 py-3">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-emerald-800">Pedido está no Bling</p>
                    <p className="text-emerald-700 text-xs mt-0.5">
                      ID {order.blingPedidoId}
                      {order.blingIntegratedAt && ` · enviado em ${new Date(order.blingIntegratedAt).toLocaleString("pt-BR")}`}
                    </p>
                  </div>
                  <button onClick={() => copy(order.blingPedidoId!, "bling")} className="ml-auto p-1 text-emerald-600/60 hover:text-emerald-800" aria-label="Copiar ID do Bling">
                    {copied === "bling" ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              ) : !isPaid ? (
                <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  <Clock size={18} className="text-gray-400" /> O pedido vai para o Bling automaticamente quando o pagamento for aprovado.
                </div>
              ) : (
                <div className={`rounded-xl px-4 py-4 ${order.blingIntegrationStatus === "error" ? "bg-red-50" : "bg-amber-50"}`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className={`${order.blingIntegrationStatus === "error" ? "text-red-600" : "text-amber-600"} shrink-0 mt-0.5`} />
                    <div>
                      <p className={`text-sm font-semibold ${order.blingIntegrationStatus === "error" ? "text-red-800" : "text-amber-800"}`}>
                        {order.blingIntegrationStatus === "error" ? "Falha ao enviar o pedido ao Bling" : "Pedido pago ainda não está no Bling"}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">Ao reenviar, o pedido é criado no Bling com os itens, o frete e os descontos. Se já existir, não duplica.</p>
                    </div>
                  </div>
                  <button onClick={sendToBling} disabled={blingBusy} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50">
                    {blingBusy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} {blingBusy ? "Enviando…" : "Enviar ao Bling"}
                  </button>
                </div>
              )}
              <Note msg={blingMsg} />
            </Card>
          )}

          {/* Itens */}
          <Card title={`Itens (${itemCount})`} icon={Package}>
            <ul className="divide-y divide-gray-100 -mt-1">
              {order.items.map((item) => {
                let image: string | null = null;
                try { const imgs = JSON.parse(item.product?.images || "[]"); image = Array.isArray(imgs) ? imgs[0] ?? null : null; } catch {}
                let variant = "";
                try {
                  const attrs = item.selectedAttributes ? JSON.parse(item.selectedAttributes) : null;
                  variant = attrs && Object.keys(attrs).length ? attributesLabel(attrs) : [item.size, item.color].filter(Boolean).join(" · ");
                } catch { variant = [item.size, item.color].filter(Boolean).join(" · "); }
                return (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <span className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                      {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : <Package size={18} className="m-auto mt-4 text-gray-400" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.product?.name || "Produto removido"}</p>
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
              <div className="flex justify-between text-gray-600"><dt>Frete</dt><dd className="tabular-nums">{order.shippingCost > 0 ? formatCurrency(order.shippingCost) : "Grátis"}</dd></div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-700"><dt className="inline-flex items-center gap-1"><Tag size={13} /> Cupom {order.couponCode}</dt><dd className="tabular-nums">−{formatCurrency(couponDiscount)}</dd></div>
              )}
              {otherDiscount > 0 && (
                <div className="flex justify-between text-emerald-700"><dt>Desconto Pix</dt><dd className="tabular-nums">−{formatCurrency(otherDiscount)}</dd></div>
              )}
              <div className="flex justify-between font-semibold text-gray-900 text-base pt-1.5 border-t border-gray-100"><dt>Total</dt><dd className="tabular-nums">{formatCurrency(order.total)}</dd></div>
              {order.paymentFee ? <div className="flex justify-between text-xs text-gray-400"><dt>Taxa do gateway</dt><dd className="tabular-nums">−{formatCurrency(order.paymentFee)}</dd></div> : null}
            </dl>
          </Card>
        </div>

        {/* Lateral */}
        <div className="space-y-5">
          <Card title="Cliente" icon={User}>
            <p className="font-medium text-gray-900">{order.customerName}</p>
            {order.cpfCnpj && <p className="text-xs text-gray-500 mt-0.5">CPF/CNPJ {order.cpfCnpj}</p>}
            <div className="mt-3 space-y-2 text-sm">
              {order.customerEmail && (
                <a href={`mailto:${order.customerEmail}`} className="flex items-center gap-2 text-gray-700 hover:text-gray-900 break-all"><Mail size={14} className="text-gray-400 shrink-0" />{order.customerEmail}</a>
              )}
              <p className="flex items-center gap-2 text-gray-700"><Phone size={14} className="text-gray-400 shrink-0" />{order.customerPhone}</p>
            </div>
            {phoneDigits && (
              <a
                href={`https://wa.me/${phoneDigits.length <= 11 ? "55" : ""}${phoneDigits}?text=${encodeURIComponent(`Olá, ${order.customerName.split(" ")[0]}! Sobre o seu pedido ${order.orderNumber}:`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:brightness-95"
              >
                <MessageCircle size={15} /> Conversar no WhatsApp
              </a>
            )}
          </Card>

          {(order.address || order.city) && (
            <Card title="Endereço de entrega" icon={MapPin}>
              <p className="text-sm text-gray-700 leading-relaxed">
                {order.address}{order.streetNumber && !order.address?.includes(order.streetNumber) ? `, ${order.streetNumber}` : ""}
                {order.neighborhood && <><br />{order.neighborhood}</>}
                {order.zipCode && <><br />CEP {order.zipCode}</>}
              </p>
              <button
                onClick={() => copy([order.customerName, order.address, order.streetNumber, order.neighborhood, order.zipCode && `CEP ${order.zipCode}`].filter(Boolean).join(", "), "addr")}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900"
              >
                {copied === "addr" ? <><Check size={13} className="text-emerald-600" /> Copiado</> : <><Copy size={13} /> Copiar endereço</>}
              </button>
            </Card>
          )}

          <Card title="Pagamento" icon={CreditCard}>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Forma</dt><dd className="text-gray-900 text-right">{order.paymentMethod || "—"}</dd></div>
              {order.paymentGateway && <div className="flex justify-between gap-3"><dt className="text-gray-500">Gateway</dt><dd className="text-gray-900 capitalize">{order.paymentGateway}</dd></div>}
              {order.paymentId && <div className="flex justify-between gap-3"><dt className="text-gray-500">ID do pagamento</dt><dd className="font-mono text-xs text-gray-700 truncate max-w-[150px]" title={order.paymentId}>{order.paymentId}</dd></div>}
            </dl>
          </Card>

          <Card title="Origem da venda" icon={Globe}>
            <p className="text-sm font-medium text-gray-900">{order.trafficChannel || "Não identificado"}</p>
            {(order.utmSource || order.utmMedium || order.utmCampaign) && (
              <p className="text-xs text-gray-500 mt-1">{[order.utmSource, order.utmMedium, order.utmCampaign].filter(Boolean).join(" · ")}</p>
            )}
          </Card>

          {order.notes && (
            <Card title="Observações" icon={FileText}>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{order.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
