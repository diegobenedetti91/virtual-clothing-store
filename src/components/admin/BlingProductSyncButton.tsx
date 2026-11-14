"use client";

import { useState } from "react";
import { notify } from "@/lib/notify";
import { Upload, CheckCircle } from "lucide-react";
import { Button } from "@/components/admin/ui/Button";

export default function BlingProductSyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ sincronizados: number; erros: number; total: number; message: string } | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/produtos/bling-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const error = await res.json();
        notify.error("Falha ao sincronizar com o Bling", { description: error.error });
        setLoading(false);
        return;
      }

      const data = await res.json();
      setResult(data);
      notify.success(data.message || "Sincronização concluída");
    } catch (err) {
      notify.error("Erro ao sincronizar produtos", { description: "Verifique a conexão e tente de novo." });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      icon={result ? CheckCircle : Upload}
      onClick={handleSync}
      loading={loading}
      loadingText="Sincronizando..."
    >
      {result ? "Sincronizado" : "Sincronizar Bling"}
    </Button>
  );
}
