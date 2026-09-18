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
      setReturns(data);
    } catch (error) {
      console.error("Erro ao buscar devoluções:", error);
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-96 overflow-y-auto p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Análise de Devolução</h2>
              <button onClick={() => setSelectedReturn(null)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-xs text-gray-500">Pedido</p>
                <p className="font-bold">{selectedReturn.order.orderNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="font-bold">{selectedReturn.customer.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm">{selectedReturn.customer.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                {statusBadge(selectedReturn.status)}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-xs text-gray-600 mb-2">Motivo da Devolução:</p>
              <p className="text-gray-900">{selectedReturn.reason}</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {selectedReturn.status !== "PENDING" && (
              <div className="space-y-4">
                {selectedReturn.adminNotes && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Análise do Produto</label>
                    <div className="bg-gray-100 rounded-lg p-3">
                      <p className="text-sm text-gray-900">{selectedReturn.adminNotes}</p>
                    </div>
                  </div>
                )}

                {selectedReturn.images && JSON.parse(selectedReturn.images).length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Imagens do Produto</label>
                    <div className="grid grid-cols-2 gap-3">
                      {JSON.parse(selectedReturn.images).map((img: any, idx: number) => (
                        <a key={idx} href={img.url} target="_blank" rel="noopener noreferrer">
                          <img src={img.url} alt={`Imagem ${idx + 1}`} className="w-full h-32 object-cover rounded-lg hover:opacity-80 cursor-pointer" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedReturn.status === "PENDING" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Análise do Produto</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Descreva a análise realizada no produto..."
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Upload size={16} />
                    Imagens do Produto
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => setImages(Array.from(e.target.files || []))}
                    className="w-full"
                  />
                  {images.length > 0 && <p className="text-xs text-gray-600 mt-1">{images.length} arquivo(s) selecionado(s)</p>}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedReturn(null)}
                    className="flex-1 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={processingId === selectedReturn.id}
                    className="flex-1 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {processingId === selectedReturn.id ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                    Recusar
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={processingId === selectedReturn.id}
                    className="flex-1 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {processingId === selectedReturn.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Aprovar
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
