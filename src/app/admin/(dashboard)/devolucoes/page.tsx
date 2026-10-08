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
    const styles: Record<string, [string, string]> = {
      PENDING: ["Nova", "bg-amber-50 text-amber-700 ring-amber-200"],
      AWAITING_RETURN: ["Aguardando mercadoria", "bg-blue-50 text-blue-700 ring-blue-200"],
      APPROVED: ["Aprovada", "bg-green-50 text-green-700 ring-green-200"],
      REJECTED: ["Recusada", "bg-red-50 text-red-700 ring-red-200"],
    };
    const [label, cls] = styles[status] || [status, "bg-gray-50 text-gray-700 ring-gray-200"];
    return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${cls}`}>{label}</span>;
  };

  const trackingLink = (code: string) => {
    const { carrier, url } = getCarrierTracking(code);
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-gray-900 hover:underline" onClick={(e) => e.stopPropagation()}>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start gap-4 px-6 py-5 border-b border-gray-100">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900">Devolução {selectedReturn.order.orderNumber}</h2>
                  {statusBadge(selectedReturn.status)}
                </div>
                <p className="text-sm text-gray-500 mt-1">Solicitada em {new Date(selectedReturn.createdAt).toLocaleDateString("pt-BR")}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition shrink-0">
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cliente</dt>
                  <dd className="text-sm font-medium text-gray-900 mt-1">{selectedReturn.customer.name}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">E-mail</dt>
                  <dd className="text-sm text-gray-900 mt-1 break-all">
                    <a href={`mailto:${selectedReturn.customer.email}`} className="hover:underline">{selectedReturn.customer.email}</a>
                  </dd>
                </div>
              </dl>

              <section>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Motivo</h3>
                <p className="text-sm text-gray-900 leading-relaxed bg-gray-50 rounded-lg px-4 py-3">{selectedReturn.reason}</p>
              </section>

              <section>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Itens a devolver</h3>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {returnedLines(selectedReturn).map((line) => (
                    <div key={line.itemId} className="flex justify-between items-start gap-4 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{line.item?.product.name ?? "Item não encontrado no pedido"}</p>
                        {line.item && (line.item.size || line.item.color) && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {[line.item.size && `Tamanho ${line.item.size}`, line.item.color && line.item.color].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-medium text-gray-900">{line.item ? formatCurrency(line.item.price * line.quantity) : "-"}</p>
                        {line.item && <p className="text-xs text-gray-500">{line.quantity} × {formatCurrency(line.item.price)}</p>}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center px-4 py-3 bg-gray-50 rounded-b-lg">
                    <span className="text-sm text-gray-600">
                      Valor a estornar{selectedReturn.status === "APPROVED" && (selectedReturn.refundedAt ? " · estornado" : " · estorno pendente")}
                    </span>
                    <span className="text-base font-bold text-gray-900">
                      {formatCurrency(selectedReturn.status === "APPROVED" ? selectedReturn.refundAmount : refundOf(selectedReturn))}
                    </span>
                  </div>
                </div>
              </section>

              {/* Etapa 1: admin gera a etiqueta no Melhor Envio e envia o código ao cliente */}
              {(selectedReturn.status === "PENDING" || (selectedReturn.status === "AWAITING_RETURN" && editingTracking)) && (
                <section>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Truck size={14} /> Código de postagem
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Gere a logística reversa no Melhor Envio e informe o código. O cliente recebe o código por e-mail para postar a mercadoria.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={trackingCode}
                      onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                      placeholder="Ex: AD984698169BR"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                    <button
                      onClick={handleSendTracking}
                      disabled={processingId === selectedReturn.id}
                      className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition"
                    >
                      {processingId === selectedReturn.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      Enviar ao cliente
                    </button>
                  </div>
                  {selectedReturn.status === "AWAITING_RETURN" && (
                    <button onClick={() => { setEditingTracking(false); setTrackingCode(selectedReturn.trackingCode || ""); }} className="text-xs text-gray-500 hover:text-gray-700 hover:underline mt-2">
                      Cancelar alteração
                    </button>
                  )}
                </section>
              )}

              {selectedReturn.trackingCode && !(selectedReturn.status === "AWAITING_RETURN" && editingTracking) && (
                <section>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Truck size={14} /> Postagem
                  </h3>
                  <div className="flex flex-wrap items-center justify-between gap-3 border border-gray-200 rounded-lg px-4 py-3">
                    <div>
                      {trackingLink(selectedReturn.trackingCode)}
                      {selectedReturn.labelSentAt && (
                        <p className="text-xs text-gray-500 mt-0.5">Enviado ao cliente em {new Date(selectedReturn.labelSentAt).toLocaleString("pt-BR")}</p>
                      )}
                    </div>
                    {selectedReturn.status === "AWAITING_RETURN" && (
                      <button onClick={() => setEditingTracking(true)} className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
                        Alterar código
                      </button>
                    )}
                  </div>
                </section>
              )}

              {(selectedReturn.status === "APPROVED" || selectedReturn.status === "REJECTED") && (
                <>
                  {selectedReturn.adminNotes && (
                    <section>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Análise do produto</h3>
                      <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg px-4 py-3">{selectedReturn.adminNotes}</p>
                    </section>
                  )}

                  {selectedReturn.images && JSON.parse(selectedReturn.images).length > 0 && (
                    <section>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Imagens</h3>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {JSON.parse(selectedReturn.images).map((img: any, idx: number) => (
                          <a key={idx} href={img.url} target="_blank" rel="noopener noreferrer">
                            <img src={img.url} alt={`Imagem ${idx + 1}`} className="w-full aspect-square object-cover rounded-lg border border-gray-200 hover:opacity-90 transition" />
                          </a>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}

              {(selectedReturn.status === "PENDING" || selectedReturn.status === "AWAITING_RETURN") && (
                <section className="space-y-4">
                  {selectedReturn.status === "AWAITING_RETURN" && (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                      Aprove ou recuse somente com a mercadoria em mãos. Ao aprovar, os itens voltam ao estoque e o valor é estornado ao cliente.
                    </p>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      {selectedReturn.status === "PENDING" ? "Motivo da recusa" : "Análise do produto"} *
                    </label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder={selectedReturn.status === "PENDING" ? "Preencha somente se for recusar a solicitação antes da postagem..." : "Descreva a análise realizada no produto..."}
                      rows={selectedReturn.status === "PENDING" ? 3 : 4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
                    />
                  </div>

                  {selectedReturn.status === "AWAITING_RETURN" && (
                    <div>
                      <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Imagens do produto</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => setImages(Array.from(e.target.files || []))}
                        className="hidden"
                        id="image-upload"
                      />
                      <label htmlFor="image-upload" className="flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-4 text-sm text-gray-600 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition">
                        <Upload size={16} />
                        {images.length > 0 ? `${images.length} imagem(ns) selecionada(s) · trocar` : "Adicionar imagens"}
                      </label>
                      {images.length > 0 && (
                        <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {images.map((img, idx) => (
                            <img key={idx} src={URL.createObjectURL(img)} alt={`Preview ${idx + 1}`} className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-2">A análise e as imagens vão por e-mail ao cliente junto com a decisão.</p>
                    </div>
                  )}
                </section>
              )}

              {error && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-semibold text-gray-700 rounded-lg hover:bg-gray-100 transition"
              >
                Fechar
              </button>
              {(selectedReturn.status === "PENDING" || selectedReturn.status === "AWAITING_RETURN") && (
                <button
                  onClick={() => handleDecision("REJECTED")}
                  disabled={processingId === selectedReturn.id}
                  className="px-4 py-2 text-sm font-semibold text-red-700 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-60 flex items-center justify-center gap-2 transition"
                >
                  {processingId === selectedReturn.id ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                  Recusar
                </button>
              )}
              {selectedReturn.status === "AWAITING_RETURN" && (
                <button
                  onClick={() => handleDecision("APPROVED")}
                  disabled={processingId === selectedReturn.id}
                  className="px-4 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition"
                >
                  {processingId === selectedReturn.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Aprovar e estornar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
