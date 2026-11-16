import { Suspense } from "react";
import AuthShell from "@/components/store/auth/AuthShell";
import ResetPasswordForm from "@/components/store/auth/ResetPasswordForm";
import { getAuthBrand } from "@/components/store/auth/authBrand";

export const metadata = { title: "Nova senha", robots: { index: false } };

export default async function ResetPasswordPage() {
  const brand = await getAuthBrand();
  return (
    <AuthShell brand={brand} eyebrow="Sua conta" title="Quase lá: crie sua nova senha">
      <Suspense fallback={<div className="img-skeleton rounded-2xl h-72" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
