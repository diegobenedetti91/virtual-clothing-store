"use client";

import { useEffect, useState } from "react";
import { Package, Check, X, Loader2, Upload, Truck, Send, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getCarrierTracking } from "@/lib/carrierTracking";

interface Return {
  id: string;
  orderId: string;
  status: string;
  reason: string;
  createdAt: string;
  responseDate?: string;
  adminNotes?: string;
  images?: string;
  returnedItems?: Array<{ itemId: string; quantity: number }>;
  refundAmount: number;
  refundedAt?: string | null;
  trackingCode?: string | null;
  labelSentAt?: string | null;
  order: {
    orderNumber: string;
    customerName: string;
    total: number;
    items: Array<{
      id: string;
      quantity: number;
      price: number;
      size?: string | null;
      color?: string | null;
      product: { name: string };
    }>;
  };
  customer: {
    name: string;
    email: string;
  };
}

const STATUS_TABS = [
  { status: "PENDING", label: "⏳ Novas" },
  { status: "AWAITING_RETURN", label: "🚚 Aguardando mercadoria" },
  { status: "APPROVED", label: "✅ Aprovadas" },
  { status: "REJECTED", label: "❌ Recusadas" },
];

export default function DevolucoesPage() {
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [editingTracking, setEditingTracking] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchReturns();
  }, [statusFilter]);

  const fetchReturns = async () => {
    try {
      const res = await fetch(`/api/admin/returns?status=${statusFilter}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao buscar devoluções");
        setReturns([]);
      } else {
        setReturns(Array.isArray(data) ? data : []);
        setError(null);
      }
    } catch (error) {
      console.error("Erro ao buscar devoluções:", error);
      setError("Erro ao buscar devoluções");
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  const openReturn = (ret: Return) => {
    setSelectedReturn(ret);
    setTrackingCode(ret.trackingCode || "");
    setEditingTracking(false);
    setAdminNotes("");
    setImages([]);
    setError(null);
  };

  const closeModal = () => {
    setSelectedReturn(null);
    setAdminNotes("");
    setTrackingCode("");
    setImages([]);
    setError(null);
  };

  const handleSendTracking = async () => {
    if (!selectedReturn) return;
    if (!trackingCode.trim()) {
      setError("Informe o código de rastreio da etiqueta gerada no Melhor Envio");
      return;
    }

    setProcessingId(selectedReturn.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/returns/${selectedReturn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SEND_TRACKING", trackingCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao enviar código de rastreio");
        return;
      }

      setNotice({ ok: true, message: `Código ${data.trackingCode} enviado por email ao cliente (pedido ${selectedReturn.order.orderNumber}).` });
      closeModal();
      fetchReturns();
    } catch (err) {
      console.error("Erro ao enviar código de rastreio:", err);
      setError("Erro ao enviar código de rastreio");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecision = async (status: "APPROVED" | "REJECTED") => {
    if (!selectedReturn) return;
    if (!adminNotes.trim()) {
      setError(status === "APPROVED" ? "Descreva a análise do produto antes de aprovar" : "Informe o motivo da recusa");
      return;
    }
    if (status === "APPROVED" && !confirm(`Aprovar a devolução? Será feito o estorno de ${formatCurrency(refundOf(selectedReturn))} e os itens voltarão ao estoque.`)) {
      return;
    }

    setProcessingId(selectedReturn.id);
    setError(null);
    try {
      const imagesData = await Promise.all(
        images.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          return await res.json();
        })
      );

      const res = await fetch(`/api/admin/returns/${selectedReturn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          adminNotes,
          images: imagesData,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao processar devolução");
        return;
      }

      if (status === "APPROVED") {
        setNotice(
          data.refund
            ? { ok: data.refund.success, message: data.refund.success ? data.refund.message : `Devolução aprovada, mas o estorno FALHOU: ${data.refund.message}. Faça o estorno manualmente no gateway.` }
            : { ok: true, message: "Devolução aprovada e itens devolvidos ao estoque." }
        );
      } else {
        setNotice({ ok: true, message: "Devolução recusada. O cliente foi avisado por email." });
      }

      closeModal();
      fetchReturns();
    } catch (err) {
      console.error("Erro ao processar devolução:", err);
      setError(err instanceof Error ? err.message : "Erro ao processar devolução");
    } finally {
      setProcessingId(null);
    }
  };

  const returnedLines = (ret: Return) =>
    (ret.returnedItems || []).map((ri) => {
      const item = ret.order.items.find((i) => i.id === ri.itemId);
      return { ...ri, item };
    });

  const refundOf = (ret: Return) =>
    returnedLines(ret).reduce((sum, line) => sum + (line.item ? line.item.price * line.quantity : 0), 0);

  const statusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">⏳ Nova</span>;
      case "AWAITING_RETURN":
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">🚚 Aguardando mercadoria</span>;
      case "APPROVED":
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">✅ Aprovada</span>;
      case "REJECTED":
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">❌ Recusada</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  const trackingLink = (code: string) => {
    const { carrier, url } = getCarrierTracking(code);
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono font-semibold text-blue-700 hover:underline" onClick={(e) => e.stopPropagation()}>
        {code}
        {carrier && <span className="font-sans text-xs text-gray-500">({carrier})</span>}
        <ExternalLink size={14} />
      </a>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 size={32} className="animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Package size={32} />
          Devoluções
        </h1>
        <p className="text-gray-600">Gerencie solicitações de devoluções de clientes</p>
      </div>

      {notice && (
        <div className={`flex justify-between items-start gap-3 rounded-lg p-4 border ${notice.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
          <p className="text-sm font-medium">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="opacity-60 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.status}
              onClick={() => setStatusFilter(tab.status)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                statusFilter === tab.status
                  ? "bg-brand text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {returns.length === 0 ? (
        <div className="text-center py-12">
          <Package size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600">Nenhuma devolução neste status</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {returns.map((ret) => (
            <div
              key={ret.id}
              className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openReturn(ret)}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{ret.order.orderNumber}</p>
                  <p className="text-sm text-gray-600">{ret.order.customerName}</p>
                </div>
                <div className="text-right space-y-1">
                  {statusBadge(ret.status)}
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(refundOf(ret))}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-2">{ret.reason}</p>
              {ret.trackingCode && (
                <p className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                  <Truck size={14} /> {trackingLink(ret.trackingCode)}
                </p>
              )}
              <p className="text-xs text-gray-400">Solicitada em {new Date(ret.createdAt).toLocaleDateString("pt-BR")}</p>
            </div>
          ))}
        </div>
      )}

      {selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Análise de Devolução</h2>
                <p className="text-gray-500 mt-1">Pedido {selectedReturn.order.orderNumber}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition">
                <X size={28} />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-4 border border-pink-200">
                <p className="text-xs font-semibold text-pink-600 uppercase tracking-wide">Pedido</p>
                <p className="font-bold text-lg text-pink-900 mt-2">{selectedReturn.order.orderNumber}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Cliente</p>
                <p className="font-bold text-lg text-blue-900 mt-2">{selectedReturn.customer.name}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Email</p>
                <p className="text-sm text-purple-900 mt-2 truncate">{selectedReturn.customer.email}</p>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</p>
                <div className="mt-2">{statusBadge(selectedReturn.status)}</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 mb-6 border border-orange-200">
              <p className="text-sm font-semibold text-orange-700 uppercase tracking-wide mb-2">📋 Motivo da Devolução</p>
              <p className="text-gray-900 leading-relaxed">{selectedReturn.reason}</p>
            </div>

            <div className="rounded-xl border border-gray-200 mb-8 overflow-hidden">
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide px-6 pt-5 pb-3">📦 Itens a devolver</p>
              <div className="divide-y divide-gray-100">
                {returnedLines(selectedReturn).map((line) => (
                  <div key={line.itemId} className="flex justify-between items-center px-6 py-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{line.item?.product.name ?? "Item não encontrado no pedido"}</p>
                      {line.item && (line.item.size || line.item.color) && (
                        <p className="text-xs text-gray-500">
                          {[line.item.size && `Tamanho: ${line.item.size}`, line.item.color && `Cor: ${line.item.color}`].filter(Boolean).join(" • ")}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-gray-600">{line.quantity}x {line.item ? formatCurrency(line.item.price) : "-"}</p>
                      {line.item && <p className="font-semibold text-gray-900">{formatCurrency(line.item.price * line.quantity)}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-t border-gray-200">
                <span className="text-sm font-semibold text-gray-700">
                  Valor a estornar {selectedReturn.status === "APPROVED" && (selectedReturn.refundedAt ? "(estornado)" : "(estorno pendente)")}
                </span>
                <span className="text-xl font-bold text-pink-600">
                  {formatCurrency(selectedReturn.status === "APPROVED" ? selectedReturn.refundAmount : refundOf(selectedReturn))}
                </span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Etapa 1: admin gera a etiqueta no Melhor Envio e envia o código ao cliente */}
            {(selectedReturn.status === "PENDING" || (selectedReturn.status === "AWAITING_RETURN" && editingTracking)) && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8 space-y-3">
                <p className="text-sm font-semibold text-blue-800 uppercase tracking-wide flex items-center gap-2">
                  <Truck size={18} /> Etiqueta de devolução
                </p>
                <p className="text-xs text-blue-700">
                  Gere a etiqueta reversa no Melhor Envio e informe o código de rastreio. O cliente receberá o código por email para postar a mercadoria.
                </p>
                <div className="flex gap-3">
                  <input
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                    placeholder="Ex: AD984698169BR"
                    className="flex-1 border-2 border-gray-300 rounded-lg px-4 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  />
                  <button
                    onClick={handleSendTracking}
                    disabled={processingId === selectedReturn.id}
                    className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 transition-colors"
                  >
                    {processingId === selectedReturn.id ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    Enviar ao cliente
                  </button>
                </div>
                {selectedReturn.status === "AWAITING_RETURN" && (
                  <button onClick={() => { setEditingTracking(false); setTrackingCode(selectedReturn.trackingCode || ""); }} className="text-xs text-blue-700 hover:underline">
                    Cancelar alteração
                  </button>
                )}
              </div>
            )}

            {selectedReturn.trackingCode && !(selectedReturn.status === "AWAITING_RETURN" && editingTracking) && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
                <p className="text-sm font-semibold text-blue-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Truck size={18} /> Postagem da devolução
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    {trackingLink(selectedReturn.trackingCode)}
                    {selectedReturn.labelSentAt && (
                      <p className="text-xs text-blue-700 mt-1">Código enviado ao cliente em {new Date(selectedReturn.labelSentAt).toLocaleString("pt-BR")}</p>
                    )}
                  </div>
                  {selectedReturn.status === "AWAITING_RETURN" && (
                    <button onClick={() => setEditingTracking(true)} className="text-sm text-blue-700 hover:underline">
                      Alterar código
                    </button>
                  )}
                </div>
              </div>
            )}

            {(selectedReturn.status === "APPROVED" || selectedReturn.status === "REJECTED") && (
              <div className="space-y-8">
                {selectedReturn.adminNotes && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                    <p className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-3">✓ Análise do Produto</p>
                    <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">{selectedReturn.adminNotes}</p>
                  </div>
                )}

                {selectedReturn.images && JSON.parse(selectedReturn.images).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">📸 Imagens do Produto</p>
                    <div className="grid grid-cols-3 gap-4">
                      {JSON.parse(selectedReturn.images).map((img: any, idx: number) => (
                        <a key={idx} href={img.url} target="_blank" rel="noopener noreferrer" className="group">
                          <div className="relative overflow-hidden rounded-xl shadow-md hover:shadow-lg transition-all">
                            <img src={img.url} alt={`Imagem ${idx + 1}`} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                              <span className="text-white text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Ampliar</span>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(selectedReturn.status === "PENDING" || selectedReturn.status === "AWAITING_RETURN") && (
              <div className="space-y-6">
                {selectedReturn.status === "AWAITING_RETURN" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">
                      ⚠️ Aprove ou recuse somente com a mercadoria em mãos. Ao aprovar, os itens voltam ao estoque e o valor acima é estornado ao cliente.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    📝 {selectedReturn.status === "PENDING" ? "Motivo da recusa" : "Análise do Produto"} *
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder={selectedReturn.status === "PENDING" ? "Preencha somente se for recusar a solicitação antes da postagem..." : "Descreva detalhadamente a análise realizada no produto..."}
                    rows={selectedReturn.status === "PENDING" ? 3 : 5}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
                  />
                </div>

                {selectedReturn.status === "AWAITING_RETURN" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Upload size={18} />
                      Imagens do Produto
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-brand hover:bg-pink-50 transition-all cursor-pointer">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => setImages(Array.from(e.target.files || []))}
                        className="hidden"
                        id="image-upload"
                      />
                      <label htmlFor="image-upload" className="cursor-pointer block">
                        <p className="text-gray-600 font-medium">Clique para adicionar imagens</p>
                        <p className="text-xs text-gray-500 mt-1">ou arraste arquivos</p>
                      </label>
                    </div>
                    {images.length > 0 && (
                      <div className="mt-4 grid grid-cols-4 gap-3">
                        {Array.from(images).map((img, idx) => (
                          <div key={idx} className="relative">
                            <img src={URL.createObjectURL(img)} alt={`Preview ${idx + 1}`} className="w-full h-24 object-cover rounded-lg" />
                            <span className="absolute top-1 right-1 bg-pink-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{idx + 1}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {images.length > 0 && <p className="text-sm text-green-600 mt-3 font-semibold">✓ {images.length} arquivo(s) selecionado(s)</p>}
                    <p className="text-xs text-gray-500 mt-2">As notas e imagens são enviadas por email ao cliente junto com a decisão.</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={closeModal}
                    className="flex-1 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={() => handleDecision("REJECTED")}
                    disabled={processingId === selectedReturn.id}
                    className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
                  >
                    {processingId === selectedReturn.id ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
                    Recusar Devolução
                  </button>
                  {selectedReturn.status === "AWAITING_RETURN" && (
                    <button
                      onClick={() => handleDecision("APPROVED")}
                      disabled={processingId === selectedReturn.id}
                      className="flex-1 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
                    >
                      {processingId === selectedReturn.id ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                      Aprovar e Estornar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
