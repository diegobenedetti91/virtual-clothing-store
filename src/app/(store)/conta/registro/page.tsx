import { Suspense } from "react";
import AuthShell from "@/components/store/auth/AuthShell";
import RegisterForm from "@/components/store/auth/RegisterForm";
import { getAuthBrand } from "@/components/store/auth/authBrand";

export const metadata = { title: "Criar conta" };

export default async function RegisterPage() {
  const brand = await getAuthBrand();
  return (
    <AuthShell brand={brand} eyebrow="Crie sua conta" title="Compre mais rápido e acompanhe seus pedidos">
      <Suspense fallback={<div className="img-skeleton rounded-2xl h-96" />}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
