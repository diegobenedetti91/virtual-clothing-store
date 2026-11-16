"use client";

import { Trash2 } from "lucide-react";
import { confirmDialog, notify } from "@/lib/notify";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/admin/ui/Button";

interface Props {
  id: string;
  name: string;
}

export default function DeleteProductButton({ id, name }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!(await confirmDialog({ title: `Excluir “${name}”?`, message: "O produto sai da loja e essa ação não pode ser desfeita.", confirmText: "Excluir produto", tone: "danger" }))) return;
    setLoading(true);
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) notify.error("Não foi possível excluir", { description: data.error });
    else if (data.archived) notify.info("Produto desativado", { description: data.message, duration: 9000 });
    else notify.success("Produto excluído");
    router.refresh();
    setLoading(false);
  };

  return (
    <Button
      variant="dangerGhost"
      size="iconSm"
      icon={Trash2}
      onClick={handleDelete}
      loading={loading}
      aria-label={`Excluir ${name}`}
    />
  );
}
