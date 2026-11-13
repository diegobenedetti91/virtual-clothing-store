import { Suspense } from "react";
import AuthShell from "@/components/store/auth/AuthShell";
import LoginForm from "@/components/store/auth/LoginForm";
import { getAuthBrand } from "@/components/store/auth/authBrand";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  const brand = await getAuthBrand();
  return (
    <AuthShell brand={brand} eyebrow="Sua conta" title={`Que bom te ver de novo na ${brand.storeName}`}>
      <Suspense fallback={<div className="img-skeleton rounded-2xl h-96" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
