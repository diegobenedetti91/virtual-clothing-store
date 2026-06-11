"use client";

import { useState, useMemo, useRef } from "react";
import { Order } from "@/types";
import { formatCurrency, formatDate, ORDER_STATUS } from "@/lib/utils";
import { Search, ChevronDown, ChevronUp, X, AlertCircle, User, Truck, Upload, Package } from "lucide-react";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING:                    ["CONFIRMED", "CANCELLED"],
  CONFIRMED:                  ["SHIPPED", "PRONTO_PARA_RETIRADA", "CANCELLED"],
  SHIPPED:                    ["DELIVERED", "CANCELLED"],
  PRONTO_PARA_RETIRADA:       ["RETIRADO", "CANCELLED"],
  RETIRADO:                   ["CANCELLED"],
  DELIVERED:                  ["CANCELLED"],
  CANCELLED:                  [],
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "PENDING", label: "Aguardando" },
  { value: "CONFIRMED", label: "Confirmado" },
  { value: "SHIPPED", label: "Enviado" },
  { value: "PRONTO_PARA_RETIRADA", label: "Pronto para Retirada" },
  { value: "RETIRADO", label: "Retirado" },
  { value: "DELIVERED", label: "Entregue" },
  { value: "CANCELLED", label: "Cancelado" },
];

const CANCEL_REASONS = [
  "Cliente desistiu",
  "Produto indisponível",
  "Endereço de entrega inválido",
  "Problema no pagamento",
  "Pedido duplicado",
  "Outro",
];

interface Props { initialOrders: Order[] }

interface ConfirmState {
  orderId: string;
  orderNumber: string;
  newStatus: string;
  newLabel: string;
  customerEmail: string | null;
}

interface ShippingState {
  orderId: string;
  orderNumber: string;
  customerEmail: string | null;
  customerName: string;
}

export default function OrdersManager({ initialOrders }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonCustom, setCancelReasonCustom] = useState("");
  const [shippingModal, setShippingModal] = useState<ShippingState | null>(null);
  const [trackingCode, setTrackingCode] = useState("");
  const [shippingProofFile, setShippingProofFile] = useState<File | null>(null);
  const [shippingProofUrl, setShippingProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter && order.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !order.orderNumber.toLowerCase().includes(q) &&
          !order.customerName.toLowerCase().includes(q) &&
          !((order.customerEmail || "").toLowerCase().includes(q))
        ) return false;
      }
      if (dateFrom && new Date(order.createdAt) < new Date(dateFrom)) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(order.createdAt) > end) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter, dateFrom, dateTo]);

  const totalFiltered = filtered.filter((o) => o.status !== "CANCELLED").reduce((s, o) => s + o.total, 0);

  const requestStatusChange = (order: Order, newStatus: string) => {
    if (order.status === newStatus) return;
    const linkedCustomer = (order as unknown as { customer?: { email: string; name: string } }).customer;
    const emailTarget = linkedCustomer?.email || order.customerEmail;

    if (newStatus === "SHIPPED") {
      setTrackingCode("");
      setShippingProofFile(null);
      setShippingProofUrl("");
      setShippingModal({
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerEmail: emailTarget || null,
        customerName: linkedCustomer?.name || order.customerName,
      });
      return;
    }

    if (newStatus === "CANCELLED") {
      setCancelReason(CANCEL_REASONS[0]);
      setCancelReasonCustom("");
    }

    setConfirm({
      orderId: order.id,
      orderNumber: order.orderNumber,
      newStatus,
      newLabel: ORDER_STATUS[newStatus]?.label || newStatus,
      customerEmail: emailTarget || null,
    });
  };

  const applyStatusChange = async (orderId: string, newStatus: string, extra?: Record<string, unknown>) => {
    setUpdatingStatus(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, ...extra }),
      });
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)));
    } finally {
      setUpdatingStatus(null);
    }
  };

  const confirmStatusChange = async () => {
    if (!confirm) return;
    const extra: Record<string, unknown> = {};
    if (confirm.newStatus === "CANCELLED") {
      extra.cancelReason = cancelReason === "Outro" ? cancelReasonCustom : cancelReason;
    }
    setConfirm(null);
    await applyStatusChange(confirm.orderId, confirm.newStatus, extra);
  };

  const confirmShipping = async () => {
    if (!shippingModal) return;
    let proofUrl = shippingProofUrl;

    if (shippingProofFile && !proofUrl) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", shippingProofFile);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok) proofUrl = data.url;
      } finally {
        setUploading(false);
      }
    }

    const orderId = shippingModal.orderId;
    setShippingModal(null);
    await applyStatusChange(orderId, "SHIPPED", {
      trackingCode: trackingCode.trim() || undefined,
      shippingProof: proofUrl || undefined,
    });
  };

  const clearFilters = () => { setSearch(""); setStatusFilter(""); setDateFrom(""); setDateTo(""); };
  const hasFilters = search || statusFilter || dateFrom || dateTo;
  const inputClass = "border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand transition bg-white";

  return (
    <div className="space-y-5">
      {/* Generic confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center shrink-0">
                <AlertCircle size={20} className="text-yellow-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900">Confirmar alteração</p>
                <p className="text-sm text-gray-500">Pedido {confirm.orderNumber}</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 mb-3">
              Deseja alterar o status para <strong>{confirm.newLabel}</strong>?
            </p>

            {confirm.newStatus === "CANCELLED" && (
              <div className="mb-4 space-y-2">
                <label className="block text-xs font-semibold text-gray-600">Motivo do cancelamento</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  {CANCEL_REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
                {cancelReason === "Outro" && (
                  <input
                    value={cancelReasonCustom}
                    onChange={(e) => setCancelReasonCustom(e.target.value)}
                    placeholder="Descreva o motivo..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                )}
              </div>
            )}

            {confirm.customerEmail && (
              <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-4">
                Um e-mail será enviado para <strong>{confirm.customerEmail}</strong>.
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmStatusChange} className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition-colors">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping modal */}
      {shippingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                <Truck size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900">Marcar como Enviado</p>
                <p className="text-sm text-gray-500">{shippingModal.orderNumber}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Código de rastreio (opcional)</label>
                <input
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="Ex: BR123456789BR"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Comprovante de despacho (opcional)</label>
                <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setShippingProofFile(e.target.files?.[0] || null)} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Upload size={15} />
                  {shippingProofFile ? shippingProofFile.name : "Selecionar arquivo (imagem ou PDF)"}
                </button>
              </div>

              {shippingModal.customerEmail && (
                <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                  E-mail de envio para <strong>{shippingModal.customerEmail}</strong> com rastreio{shippingProofFile ? " e comprovante em anexo" : ""}.
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShippingModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={confirmShipping}
                disabled={uploading}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {uploading ? "Enviando..." : "Confirmar envio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} pl-8 w-full`} placeholder="Nº pedido, nome ou e-mail" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">De</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Até</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors px-2 py-2 rounded-xl hover:bg-red-50">
              <X size={14} /> Limpar
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 px-1">
        <span>{filtered.length} pedido{filtered.length !== 1 ? "s" : ""}</span>
        <span className="font-semibold text-gray-900">Total: {formatCurrency(totalFiltered)}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center text-gray-400">Nenhum pedido encontrado.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const status = ORDER_STATUS[order.status] || ORDER_STATUS.PENDING;
            const isExpanded = expanded === order.id;
            const linkedCustomer = (order as unknown as { customer?: { id: string; name: string; email: string } }).customer;
            const ext = order as unknown as { cancelReason?: string; trackingCode?: string; shippingProof?: string };
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div
                  className="flex flex-wrap items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : order.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-brand">{order.orderNumber}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${status.color}`}>{status.label}</span>
                      {linkedCustomer && (
                        <span className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-semibold">
                          <User size={10} /> Cadastrado
                        </span>
                      )}
                      {ext.trackingCode && (
                        <span className="flex items-center gap-1 text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-semibold">
                          <Package size={10} /> {ext.trackingCode}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5">{order.customerName}</p>
                    <p className="text-xs text-gray-400">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">{formatCurrency(order.total)}</p>
                    <p className="text-xs text-gray-500">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</p>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cliente</h4>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm text-gray-900 font-medium">{order.customerName}</p>
                          {linkedCustomer && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold">conta vinculada</span>}
                        </div>
                        <p className="text-sm text-gray-600">{linkedCustomer?.email || order.customerEmail || "—"}</p>
                        <p className="text-sm text-gray-600">{order.customerPhone}</p>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Entrega</h4>
                        <p className="text-sm text-gray-600">{order.address || "—"}</p>
                        <p className="text-sm text-gray-600">{order.city}{order.state ? ` - ${order.state}` : ""}</p>
                        {order.zipCode && <p className="text-sm text-gray-600">CEP: {order.zipCode}</p>}
                        {ext.trackingCode && (
                          <p className="text-sm font-bold text-green-700 mt-1">Rastreio: {ext.trackingCode}</p>
                        )}
                        {ext.shippingProof && (
                          <a href={ext.shippingProof} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                            Ver comprovante de despacho
                          </a>
                        )}
                      </div>
                    </div>

                    {ext.cancelReason && (
                      <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                        <p className="text-xs font-semibold text-red-600 mb-0.5">Motivo do cancelamento</p>
                        <p className="text-sm text-red-800">{ext.cancelReason}</p>
                      </div>
                    )}

                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Itens</h4>
                      <div className="space-y-2">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 text-sm">
                            <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                              {(() => {
                                const imgs = JSON.parse(item.product?.images || "[]") as string[];
                                return imgs[0]
                                  ? <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center text-sm">👗</div>;
                              })()}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{item.product?.name}</p>
                              <p className="text-xs text-gray-500">
                                {(() => {
                                  if (item.selectedAttributes) {
                                    try {
                                      const attrs = JSON.parse(item.selectedAttributes) as Record<string, string>;
                                      return Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(" · ");
                                    } catch { /* fall through */ }
                                  }
                                  return [item.size && `Tam: ${item.size}`, item.color && `Cor: ${item.color}`].filter(Boolean).join(" · ");
                                })()}
                              </p>
                            </div>
                            <p className="text-gray-700 shrink-0">{item.quantity}× {formatCurrency(item.price)}</p>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 mt-3 pt-3 flex justify-end">
                        <span className="font-bold text-gray-900">{formatCurrency(order.total)}</span>
                      </div>
                    </div>

                    {order.notes && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Observações</h4>
                        <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{order.notes}</p>
                      </div>
                    )}

                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Alterar status</h4>
                      {order.status === "CANCELLED" ? (
                        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                          Pedido cancelado não pode ter o status alterado.
                        </p>
                      ) : (
                        <div className="flex gap-2 flex-wrap">
                          {Object.entries(ORDER_STATUS).map(([key, { label, color }]) => {
                            const isCurrent = order.status === key;
                            const isAllowed = ALLOWED_TRANSITIONS[order.status]?.includes(key) ?? false;
                            return (
                              <button
                                key={key}
                                disabled={isCurrent || !isAllowed || updatingStatus === order.id}
                                onClick={() => requestStatusChange(order, key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                  isCurrent ? color + " ring-2 ring-offset-1 ring-brand" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
