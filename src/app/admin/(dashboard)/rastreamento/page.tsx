import { Suspense } from "react";
import TrackingDashboard from "@/components/admin/TrackingDashboard";

export default function RastreamentoPage() {
  return (
    <Suspense fallback={<div className="img-skeleton rounded-2xl h-40" />}>
      <TrackingDashboard />
    </Suspense>
  );
}
