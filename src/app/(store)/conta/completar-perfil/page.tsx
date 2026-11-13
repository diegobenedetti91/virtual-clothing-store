import { Suspense } from "react";
import AuthShell from "@/components/store/auth/AuthShell";
import CompleteProfileForm from "@/components/store/auth/CompleteProfileForm";
import { getAuthBrand } from "@/components/store/auth/authBrand";

export const metadata = { title: "Completar cadastro" };

export default async function CompletarPerfilPage() {
  const brand = await getAuthBrand();
  return (
    <AuthShell brand={brand} eyebrow="Quase lá" title="Só faltam alguns dados para você comprar">
      <Suspense fallback={<div className="img-skeleton rounded-2xl h-96" />}>
        <CompleteProfileForm />
      </Suspense>
    </AuthShell>
  );
}
