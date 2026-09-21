import { Suspense } from "react";
import TrackingDashboard from "@/components/admin/TrackingDashboard";

export default function RastreamentoPage() {
  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Rastreamento de Entrega</h1>
        <p className="text-gray-500 text-sm mt-2">
          Acompanhe o status de todos os seus envios no Melhor Envio
        </p>
      </div>
      <Suspense fallback={<div className="text-gray-500">Carregando...</div>}>
        <TrackingDashboard />
      </Suspense>
    </div>
  );
}
