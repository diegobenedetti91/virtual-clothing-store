"use client";

import { useState } from "react";
import { Upload, CheckCircle } from "lucide-react";
import { Button } from "./ui/Button";

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
    <Button
      variant={result ? "secondary" : "primary"}
      icon={result ? CheckCircle : Upload}
      onClick={handleSync}
      loading={loading}
      loadingText="Sincronizando..."
    >
      {result ? "Sincronizado" : "Sincronizar Bling"}
    </Button>
  );
}
