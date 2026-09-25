"use client";

import { useState, useEffect } from "react";

interface VariantBlingMap {
  id: string;
  size: string;
  blingProdutoId: string;
}

interface VariantBlingMapFormProps {
  productId: string;
  sizes: string[]; // Ex: ["P", "M", "G", "GG"]
  defaultBlingId?: string; // Bling ID genérico do produto
}

export function VariantBlingMapForm({
  productId,
  sizes,
  defaultBlingId,
}: VariantBlingMapFormProps) {
  const [mappings, setMappings] = useState<VariantBlingMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSize, setNewSize] = useState("");
  const [newBlingId, setNewBlingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchMappings();
  }, [productId]);

  const fetchMappings = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/admin/products/variant-bling-map?productId=${productId}`
      );
      const data = await res.json();
      setMappings(data);
    } catch (err) {
      setError("Erro ao carregar mapeamentos");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSize || !newBlingId) {
      setError("Tamanho e Bling ID são obrigatórios");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/products/variant-bling-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          size: newSize,
          blingProdutoId: newBlingId,
        }),
      });

      if (!res.ok) throw new Error("Erro ao salvar");

      const data = await res.json();
      setMappings([...mappings, data.mapping]);
      setSuccess(data.message);
      setNewSize("");
      setNewBlingId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (size: string) => {
    if (!confirm(`Remover mapeamento para tamanho ${size}?`)) return;

    try {
      const res = await fetch(
        `/api/admin/products/variant-bling-map?productId=${productId}&size=${size}`,
        { method: "DELETE" }
      );

      if (!res.ok) throw new Error("Erro ao remover");

      setMappings(mappings.filter((m) => m.size !== size));
      setSuccess(`Mapeamento ${size} removido com sucesso`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover");
    }
  };

  if (loading) return <div className="p-4 text-gray-500">Carregando...</div>;

  return (
    <div className="bg-white rounded-lg p-6 mb-6">
      <h3 className="text-lg font-bold mb-4">
        🏷️ Mapeamento de Bling ID por Tamanho
      </h3>

      {defaultBlingId && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
          <p className="text-sm text-blue-700">
            <strong>Bling ID padrão do produto:</strong> {defaultBlingId}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Use os mapeamentos abaixo para definir IDs diferentes por tamanho
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 text-green-700 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleAdd} className="mb-6 p-4 bg-gray-50 rounded">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tamanho</label>
            <select
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Selecionar tamanho</option>
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Bling ID</label>
            <input
              type="text"
              value={newBlingId}
              onChange={(e) => setNewBlingId(e.target.value)}
              placeholder="Ex: 12345"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Adicionar"}
            </button>
          </div>
        </div>
      </form>

      <div className="space-y-2">
        {mappings.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhum mapeamento configurado</p>
        ) : (
          mappings.map((m) => (
            <div
              key={m.id}
              className="flex justify-between items-center bg-gray-50 p-3 rounded"
            >
              <div>
                <span className="font-medium">{m.size}</span>
                <span className="text-gray-500 mx-2">→</span>
                <span className="font-mono text-blue-600">{m.blingProdutoId}</span>
              </div>
              <button
                onClick={() => handleDelete(m.size)}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Remover
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
