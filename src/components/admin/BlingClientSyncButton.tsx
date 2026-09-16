"use client";

import { useState } from "react";
import { Upload, CheckCircle } from "lucide-react";

export default function BlingClientSyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ sincronizados: number; erros: number; total: number; message: string } | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/clientes/bling-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Erro: ${error.error || "Falha ao sincronizar"}`);
        setLoading(false);
        return;
      }

      const data = await res.json();
      setResult(data);
      alert(`✓ ${data.message}`);
    } catch (err) {
      alert("Erro ao sincronizar clientes");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={loading}
      className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
    >
      {loading ? (
        <>
          <Upload size={16} className="animate-spin" />
          Sincronizando...
        </>
      ) : result ? (
        <>
          <CheckCircle size={16} />
          Sincronizado
        </>
      ) : (
        <>
          <Upload size={16} />
          Sincronizar Bling
        </>
      )}
    </button>
  );
}
