import { Suspense } from "react";
import AuthShell from "@/components/store/auth/AuthShell";
import ForgotPasswordForm from "@/components/store/auth/ForgotPasswordForm";
import { getAuthBrand } from "@/components/store/auth/authBrand";

export const metadata = { title: "Esqueci minha senha", robots: { index: false } };

export default async function ForgotPasswordPage() {
  const brand = await getAuthBrand();
  return (
    <AuthShell brand={brand} eyebrow="Sua conta" title="Vamos recuperar seu acesso">
      <Suspense fallback={<div className="img-skeleton rounded-2xl h-72" />}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
