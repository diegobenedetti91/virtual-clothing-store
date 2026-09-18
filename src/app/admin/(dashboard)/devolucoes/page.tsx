"use client";

import { useEffect, useState } from "react";
import { Package, AlertCircle, Check, X, Loader2, Upload } from "lucide-react";

interface Return {
  id: string;
  orderId: string;
  status: string;
  reason: string;
  createdAt: string;
  responseDate?: string;
  adminNotes?: string;
  images?: string;
  order: {
    orderNumber: string;
    customerName: string;
    total: number;
    items: Array<{ name: string; quantity: number }>;
  };
  customer: {
    name: string;
    email: string;
  };
}

export default function DevolucoesPage() {
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [error, setError] = useState<string | null>(null);

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

  const handleApprove = async () => {
    if (!selectedReturn) return;
    await handleDecision("APPROVED");
  };

  const handleReject = async () => {
    if (!selectedReturn) return;
    await handleDecision("REJECTED");
  };

  const handleDecision = async (status: string) => {
    if (!selectedReturn) return;

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

      setSelectedReturn(null);
      setAdminNotes("");
      setImages([]);
      setError(null);
      fetchReturns();
    } catch (err) {
      console.error("Erro ao processar devolução:", err);
      setError(err instanceof Error ? err.message : "Erro ao processar devolução");
    } finally {
      setProcessingId(null);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">⏳ Pendente</span>;
      case "APPROVED":
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">✅ Aprovada</span>;
      case "REJECTED":
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">❌ Recusada</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">{status}</span>;
    }
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

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex gap-2">
          {["PENDING", "APPROVED", "REJECTED"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                statusFilter === status
                  ? "bg-brand text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {status === "PENDING" ? "⏳ Pendentes" : status === "APPROVED" ? "✅ Aprovadas" : "❌ Recusadas"}
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
              onClick={() => setSelectedReturn(ret)}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{ret.order.orderNumber}</p>
                  <p className="text-sm text-gray-600">{ret.order.customerName}</p>
                </div>
                {statusBadge(ret.status)}
              </div>
              <p className="text-sm text-gray-600 mb-2">{ret.reason}</p>
              <p className="text-xs text-gray-400">{new Date(ret.createdAt).toLocaleDateString("pt-BR")}</p>
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
              <button onClick={() => setSelectedReturn(null)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={28} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-6 mb-8">
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

            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 mb-8 border border-orange-200">
              <p className="text-sm font-semibold text-orange-700 uppercase tracking-wide mb-2">📋 Motivo da Devolução</p>
              <p className="text-gray-900 leading-relaxed">{selectedReturn.reason}</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {selectedReturn.status !== "PENDING" && (
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

            {selectedReturn.status === "PENDING" && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">📝 Análise do Produto *</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Descreva detalhadamente a análise realizada no produto..."
                    rows={5}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
                  />
                </div>

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
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-600 font-semibold">💡 Dica:</p>
                  <p className="text-xs text-gray-600 mt-1">Adicione imagens e notas de análise. Ao recusar, as imagens serão enviadas por email ao cliente.</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setSelectedReturn(null)}
                    className="flex-1 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={processingId === selectedReturn.id}
                    className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
                  >
                    {processingId === selectedReturn.id ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Recusando...
                      </>
                    ) : (
                      <>
                        <X size={18} />
                        Recusar Devolução
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={processingId === selectedReturn.id}
                    className="flex-1 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
                  >
                    {processingId === selectedReturn.id ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Aprovando...
                      </>
                    ) : (
                      <>
                        <Check size={18} />
                        Aprovar Devolução
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
