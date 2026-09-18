"use client";

import { useState } from "react";
import { X, Loader2, CheckCircle2, Minus, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product: {
    id: string;
    name: string;
    images: string;
  };
  size?: string | null;
  color?: string | null;
}

interface ReturnRequestModalProps {
  orderId: string;
  orderNumber: string;
  items: OrderItem[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ReturnRequestModal({
  orderId,
  orderNumber,
  items,
  isOpen,
  onClose,
  onSuccess,
}: ReturnRequestModalProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [returnedQuantities, setReturnedQuantities] = useState<Record<string, number>>({});

  // Buscar histórico de devoluções ao abrir modal
  React.useEffect(() => {
    if (isOpen) {
      fetch(`/api/orders/${orderId}/returned-items`)
        .then((r) => r.json())
        .then((data) => setReturnedQuantities(data))
        .catch(console.error);
    }
  }, [isOpen, orderId]);

  const toggleItem = (itemId: string, maxQty: number) => {
    const alreadyReturned = returnedQuantities[itemId] || 0;
    const canReturn = maxQty - alreadyReturned;
    
    setQuantities((prev) => {
      const current = prev[itemId] || 0;
      if (current === 0) {
        return { ...prev, [itemId]: canReturn };
      } else {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
    });
  };

  const updateQuantity = (itemId: string, newQty: number, maxQty: number) => {
    const alreadyReturned = returnedQuantities[itemId] || 0;
    const canReturn = maxQty - alreadyReturned;
    
    if (newQty <= 0) {
      setQuantities((prev) => {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      });
    } else if (newQty <= canReturn) {
      setQuantities((prev) => ({ ...prev, [itemId]: newQty }));
    }
  };

  const selectedItemsArray = Object.entries(quantities).map(([itemId, qty]) => ({
    itemId,
    quantity: qty,
  }));

  const totalRefund = selectedItemsArray.reduce((sum, sel) => {
    const item = items.find((i) => i.id === sel.itemId);
    return sum + (item ? item.price * sel.quantity : 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedItemsArray.length === 0) {
      setError("Selecione pelo menos um item para devolver");
      return;
    }

    if (!reason.trim()) {
      setError("Por favor, descreva o motivo da devolução");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          itemIds: selectedItemsArray,
          reason,
          returnAmount: totalRefund,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao solicitar devolução");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 2000);
    } catch {
      setError("Erro ao solicitar devolução. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Solicitar Devolução</h2>
            <p className="text-gray-500 mt-1">Pedido {orderNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            disabled={loading}
          >
            <X size={28} />
          </button>
        </div>

        {success ? (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center">
            <CheckCircle2 size={48} className="mx-auto text-green-600 mb-3" />
            <p className="text-green-700 font-semibold text-lg">✅ Solicitação enviada com sucesso!</p>
            <p className="text-sm text-green-600 mt-2">
              Em breve você receberá um email com atualizações sobre sua devolução.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Seleção de itens */}
            <div className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-4">
                📦 Itens a devolver *
              </label>

              <div className="space-y-4">
                {items.map((item) => {
                  const images = item.product.images ? JSON.parse(item.product.images) : [];
                  const image = images[0];
                  const selectedQty = quantities[item.id] || 0;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                        selectedQty > 0
                          ? "border-brand bg-pink-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id, item.quantity)}
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                          selectedQty > 0
                            ? "bg-brand border-brand"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {selectedQty > 0 && <CheckCircle2 size={16} className="text-white" />}
                      </button>

                      {image && (
                        <img src={image} alt={item.product.name} className="w-16 h-16 object-cover rounded-lg" />
                      )}

                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{item.product.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.size ? `Tamanho: ${item.size}` : ""}
                          {item.color && item.size ? " • " : ""}
                          {item.color ? `Cor: ${item.color}` : ""}
                        </p>
                      </div>

                      {selectedQty > 0 && (
                        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-300 p-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, selectedQty - 1, item.quantity)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">{selectedQty}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, selectedQty + 1, item.quantity)}
                            disabled={selectedQty >= (item.quantity - (returnedQuantities[item.id] || 0))}
                            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}

                      <div className="text-right">
                        {selectedQty > 0 ? (
                          <div>
                            <p className="text-xs text-gray-600">Devolver: {selectedQty}x</p>
                            <p className="font-semibold text-brand">{formatCurrency(item.price * selectedQty)}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-gray-600">Total: {item.quantity}x</p>
                            <p className="text-sm text-gray-500">{formatCurrency(item.price * item.quantity)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resumo de devolução */}
            {selectedItemsArray.length > 0 && (
              <div className="bg-gradient-to-r from-pink-50 to-red-50 rounded-xl p-5 border-2 border-pink-200">
                <p className="text-sm font-semibold text-gray-700 mb-3">📊 Resumo da Devolução</p>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{selectedItemsArray.length} item{selectedItemsArray.length > 1 ? 's' : ''} selecionado{selectedItemsArray.length > 1 ? 's' : ''}</span>
                  <span className="text-2xl font-bold text-pink-600">{formatCurrency(totalRefund)}</span>
                </div>
              </div>
            )}

            {/* Motivo */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                📝 Motivo da devolução *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva o motivo pelo qual deseja devolver o(s) produto(s)..."
                rows={4}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700 font-semibold">{error}</p>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || selectedItemsArray.length === 0}
                className="flex-1 py-3 bg-brand text-white font-semibold rounded-lg hover:opacity-90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    Solicitar Devolução
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
