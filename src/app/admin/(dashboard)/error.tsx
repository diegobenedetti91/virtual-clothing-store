"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/admin/ui/Button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-xl font-bold text-gray-800">Algo deu errado</h2>
      <p className="text-sm text-gray-500 max-w-md text-center">{error.message}</p>
      <Button variant="primary" icon={RotateCcw} onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
