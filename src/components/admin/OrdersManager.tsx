"use client";

import { useState, useMemo, useRef } from "react";
import { Order } from "@/types";
import { formatCurrency, formatDate, ORDER_STATUS } from "@/lib/utils";
import Link from "next/link";
import { Search, X, AlertCircle, Truck, Upload, Package, ArrowRight, ChevronRight, ClipboardList, DollarSign, Download, MoreHorizontal, Receipt } from "lucide-react";
import { useRouter } from "next/navigation";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING:                    ["CONFIRMED", "CANCELLED"],
  CONFIRMED:                  ["SHIPPED", "PRONTO_PARA_RETIRADA", "CANCELLED"],
  SHIPPED:                    ["DELIVERED", "CANCELLED"],
  PRONTO_PARA_RETIRADA:       ["RETIRADO", "CANCELLED"],
  RETIRADO:                   ["CANCELLED"],
  DELIVERED:                  ["CANCELLED"],
  CANCELLED:                  [],
};

const CANCEL_REASONS = [
  "Cliente desistiu",
  "Produto indisponível",
  "Endereço de entrega inválido",
  "Problema no pagamento",
  "Pedido duplicado",
  "Outro",
];

interface Props {
  initialOrders: Order[];
  blingEnabled?: boolean;
}

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

export default function OrdersManager({ initialOrders, blingEnabled = false }: Props) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonCustom, setCancelReasonCustom] = useState("");
  const [shippingModal, setShippingModal] = useState<ShippingState | null>(null);
  const [trackingCode, setTrackingCode] = useState("");
  const [shippingProofFile, setShippingProofFile] = useState<File | null>(null);
  const [shippingProofUrl, setShippingProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [retryingBling, setRetryingBling] = useState<string | null>(null);
  const [blingRetryMessage, setBlingRetryMessage] = useState<{ orderId: string; type: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);




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
      if (!res.ok) {
        const error = await res.json();
        alert(`Erro: ${error.error || "Não foi possível alterar o status"}`);
        return;
      }
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)));
    } catch (err) {
      alert("Erro ao alterar status do pedido");
      console.error(err);
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

  const retryBlingIntegration = async (orderId: string) => {
    setRetryingBling(orderId);
    setBlingRetryMessage(null);
    try {
      const res = await fetch("/api/admin/pedidos/bling-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (res.ok) {
        setBlingRetryMessage({
          orderId,
          type: "success",
          text: `✓ Integrado com sucesso (ID: ${data.blingId})`,
        });
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  blingIntegrationStatus: "success",
                  blingIntegratedAt: new Date().toISOString(),
                  blingPedidoId: data.blingId,
                }
              : o
          )
        );
        setTimeout(() => setBlingRetryMessage(null), 3000);
      } else {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, blingIntegrationStatus: "error" } : o)));
        setBlingRetryMessage({
          orderId,
          type: "error",
          text: data.error || "Erro ao integrar com Bling",
        });
      }
    } catch (err) {
      setBlingRetryMessage({
        orderId,
        type: "error",
        text: "Erro ao chamar API",
      });
    } finally {
      setRetryingBling(null);
    }
  };

  const clearFilters = () => { setSearch(""); setStatusFilter(""); setDateFrom(""); setDateTo(""); };
  const hasFilters = search || statusFilter || dateFrom || dateTo;

  // Contadores por aba (respeitam busca e datas, não o status)
  const baseFiltered = useMemo(() => {
    return orders.filter((order) => {
      if (search) {
        const q = search.toLowerCase();
        if (!order.orderNumber.toLowerCase().includes(q) && !order.customerName.toLowerCase().includes(q) && !((order.customerEmail || "").toLowerCase().includes(q))) return false;
      }
      if (dateFrom && new Date(order.createdAt) < new Date(dateFrom)) return false;
      if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); if (new Date(order.createdAt) > end) return false; }
      return true;
    });
  }, [orders, search, dateFrom, dateTo]);
  const countOf = (st: string) => (st ? baseFiltered.filter((o) => st.split(",").includes(o.status)).length : baseFiltered.length);
  const visible = statusFilter ? baseFiltered.filter((o) => statusFilter.split(",").includes(o.status)) : baseFiltered;
  const [limit, setLimit] = useState(40);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const paidVisible = visible.filter((o) => o.status !== "CANCELLED" && o.status !== "PENDING");
  const revenue = paidVisible.reduce((s, o) => s + o.total, 0);

  const TABS = [
    { value: "", label: "Todos" },
    { value: "PENDING", label: "Aguardando pagamento" },
    { value: "CONFIRMED", label: "Pagos · a enviar" },
    { value: "PRONTO_PARA_RETIRADA", label: "Pronto p/ retirada" },
    { value: "SHIPPED", label: "Enviados" },
    { value: "DELIVERED,RETIRADO", label: "Concluídos" },
    { value: "CANCELLED", label: "Cancelados" },
  ];

  const NEXT: Record<string, { to: string; label: string }> = {
    PENDING: { to: "CONFIRMED", label: "Confirmar pagamento" },
    CONFIRMED: { to: "SHIPPED", label: "Marcar enviado" },
    PRONTO_PARA_RETIRADA: { to: "RETIRADO", label: "Cliente retirou" },
    SHIPPED: { to: "DELIVERED", label: "Marcar entregue" },
  };

  const exportCsv = () => {
    const head = ["Pedido", "Data", "Cliente", "E-mail", "Telefone", "Status", "Pagamento", "Itens", "Total", "Cupom", "Rastreio"];
    const lines = visible.map((o) => {
      const x = o as unknown as Ext;
      return [o.orderNumber, new Date(o.createdAt).toLocaleString("pt-BR"), o.customerName, o.customerEmail || "", o.customerPhone, ORDER_STATUS[o.status]?.label || o.status, o.paymentMethod || "", o.items.reduce((s, i) => s + i.quantity, 0), String(o.total).replace(".", ","), x.couponCode || "", x.trackingCode || ""]
        .map((v) => { const t = String(v ?? ""); return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }).join(";");
    });
    const blob = new Blob([`﻿${head.join(";")}\n${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-5">
      {/* Generic confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(17,24,39,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-fade-up [animation-duration:0.25s]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(17,24,39,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-fade-up [animation-duration:0.25s]">
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


      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Pedidos na lista", value: String(visible.length), icon: ClipboardList },
          { label: "Faturamento (pagos)", value: formatCurrency(revenue), icon: DollarSign },
          { label: "Ticket médio", value: paidVisible.length ? formatCurrency(revenue / paidVisible.length) : "—", icon: Receipt },
          { label: "Pagos para enviar", value: String(countOf("CONFIRMED")), icon: Package, highlight: countOf("CONFIRMED") > 0 },
        ].map(({ label, value, icon: Icon, highlight }) => (
          <div key={label} className={`bg-white rounded-2xl border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${highlight ? "border-blue-200" : "border-gray-200/70"}`}>
            <p className="text-[13px] text-gray-500 flex items-center gap-1.5"><Icon size={14} className="text-gray-400" />{label}</p>
            <p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Abas por status */}
      <div className="border-b border-gray-200 flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {TABS.map((t) => {
          const n = countOf(t.value);
          const active = statusFilter === t.value;
          return (
            <button key={t.value || "all"} onClick={() => { setStatusFilter(t.value); setLimit(40); }} className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${active ? "text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>
              {t.label}
              <span className={`text-[11px] font-semibold rounded-full px-1.5 tabular-nums ${t.value === "CONFIRMED" && n > 0 ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>{n}</span>
              <span className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gray-900 transition-transform ${active ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          );
        })}
      </div>

      {/* Busca e datas */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 text-[13px] rounded-xl border border-gray-200 bg-white" placeholder="Buscar por nº do pedido, nome ou e-mail" />
        </label>
        <div className="inline-flex items-center gap-1.5 rounded-xl bg-white px-2.5 py-1.5 ring-1 ring-gray-200">
          <span className="text-xs text-gray-400">De</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-[13px] bg-transparent outline-none w-[118px]" aria-label="De" />
          <span className="text-xs text-gray-400">até</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-[13px] bg-transparent outline-none w-[118px]" aria-label="Até" />
        </div>
        {hasFilters && <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 px-2 py-2"><X size={13} /> Limpar</button>}
        <button onClick={exportCsv} disabled={visible.length === 0} className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 px-3 py-2 rounded-xl bg-white ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-40">
          <Download size={13} /> Exportar CSV
        </button>
      </div>

      {blingRetryMessage && (
        <div className={`text-sm rounded-xl px-4 py-2.5 ${blingRetryMessage.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{blingRetryMessage.text}</div>
      )}

      {visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <ClipboardList size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">Nenhum pedido encontrado</p>
          {hasFilters && <button onClick={clearFilters} className="mt-2 text-sm text-gray-500 hover:text-gray-900 underline">Limpar filtros</button>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="hidden lg:grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_210px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-100 bg-gray-50/60 rounded-t-2xl">
            <span>Pedido</span><span>Cliente</span><span>Itens</span><span>Situação</span><span className="text-right">Total</span><span className="text-right">Ações</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {visible.slice(0, limit).map((order, rowIndex, arr) => {
              const openUp = arr.length > 2 && rowIndex >= arr.length - 2;
              const st = ORDER_STATUS[order.status] || ORDER_STATUS.PENDING;
              const x = order as unknown as Ext;
              const units = order.items.reduce((s, i) => s + i.quantity, 0);
              const next = NEXT[order.status];
              const nextTo = next && order.status === "CONFIRMED" && x.shippingMethod === "retirada" ? { to: "PRONTO_PARA_RETIRADA", label: "Pronto p/ retirada" } : next;
              const others = (ALLOWED_TRANSITIONS[order.status] || []).filter((s2) => s2 !== nextTo?.to);
              const usesLabel = !!x.shippingMethod && /^\d+$/.test(x.shippingMethod);
              const paid = order.status !== "PENDING" && order.status !== "CANCELLED";
              return (
                <li
                  key={order.id}
                  onClick={() => router.push(`/admin/pedidos/${order.id}`)}
                  className={`group grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_210px] gap-2 lg:gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50/80 transition-colors ${updatingStatus === order.id ? "opacity-60 pointer-events-none" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 group-hover:text-brand">{order.orderNumber}</p>
                    <p className="text-xs text-gray-400">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{order.customerName}</p>
                    <p className="text-xs text-gray-400 truncate">{x.customer?.email || order.customerEmail || order.customerPhone}</p>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex -space-x-2">
                      {order.items.slice(0, 3).map((it) => {
                        let img: string | null = null;
                        try { img = (JSON.parse(it.product?.images || "[]") as string[])[0] ?? null; } catch {}
                        return <span key={it.id} className="w-8 h-8 rounded-lg ring-2 ring-white bg-gray-100 overflow-hidden shrink-0">{img ? <img src={img} alt="" className="w-full h-full object-cover" /> : null}</span>;
                      })}
                    </div>
                    <span className="text-xs text-gray-500">{units} {units === 1 ? "peça" : "peças"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-[10.5px] font-medium">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.color}`}>{st.label}</span>
                    {order.paymentMethod && <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">{order.paymentMethod}</span>}
                    {usesLabel && paid && order.status === "CONFIRMED" && (
                      x.melhorEnvioShipmentId && x.labelValid !== false
                        ? <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700">Etiqueta ok</span>
                        : <span className="px-1.5 py-0.5 rounded-md bg-red-50 text-red-700" title={x.shipmentRetryError || undefined}>{x.shipmentRetryError ? "Erro na etiqueta" : "Sem etiqueta"}</span>
                    )}
                    {blingEnabled && paid && (
                      order.blingPedidoId
                        ? <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700">Bling ✓</span>
                        : <button onClick={(e) => { e.stopPropagation(); retryBlingIntegration(order.id); }} className="px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 hover:bg-red-100" title="Enviar ao Bling agora">{retryingBling === order.id ? "Enviando…" : "Fora do Bling ↻"}</button>
                    )}
                    {x.couponCode && <span className="px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700">{x.couponCode}</span>}
                    {x.trackingCode && order.status === "SHIPPED" && <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 font-mono">{x.trackingCode}</span>}
                    {x.returnStatus && <span className="px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-700">{x.returnStatus === "FULL_RETURN" ? "Devolvido" : "Devolução parcial"}</span>}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 lg:text-right tabular-nums">{formatCurrency(order.total)}</p>
                  <div className="flex items-center lg:justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {nextTo && (
                      <button onClick={() => requestStatusChange(order, nextTo.to)} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 whitespace-nowrap">
                        <ArrowRight size={12} /> {nextTo.label}
                      </button>
                    )}
                    {(
                      <div className="relative">
                        <button onClick={() => setMenuFor(menuFor === order.id ? null : order.id)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Mais ações"><MoreHorizontal size={16} /></button>
                        {menuFor === order.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                            <div className={`absolute right-0 z-30 w-52 rounded-xl bg-white shadow-xl ring-1 ring-black/10 py-1 animate-fade-up [animation-duration:0.15s] ${openUp ? "bottom-full mb-1" : "top-full mt-1"}`}>
                              <Link href={`/admin/pedidos/${order.id}`} className="block px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 border-b border-gray-100">Abrir pedido (etiqueta e Bling)</Link>
                              {others.map((s2) => (
                                <button key={s2} onClick={() => { setMenuFor(null); requestStatusChange(order, s2); }} className={`w-full text-left px-3 py-2 text-[13px] hover:bg-gray-50 ${s2 === "CANCELLED" ? "text-red-600" : "text-gray-700"}`}>
                                  {s2 === "CANCELLED" ? "Cancelar pedido" : `Mover para ${ORDER_STATUS[s2]?.label || s2}`}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <Link
                      href={`/admin/pedidos/${order.id}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100"
                      aria-label={`Abrir pedido ${order.orderNumber}`}
                      title="Abrir pedido"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          {visible.length > limit && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Mostrando {limit} de {visible.length}</span>
              <button onClick={() => setLimit((l) => l + 40)} className="font-medium text-gray-700 hover:text-gray-900">Ver mais</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Ext {
  shippingMethod?: string | null;
  melhorEnvioShipmentId?: string | null;
  labelValid?: boolean | null;
  shipmentRetryError?: string | null;
  couponCode?: string | null;
  trackingCode?: string | null;
  returnStatus?: string | null;
  customer?: { email: string } | null;
}
