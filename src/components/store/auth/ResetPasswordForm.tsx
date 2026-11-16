"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Lock, ShieldAlert } from "lucide-react";
import { useCustomer } from "@/hooks/useCustomer";
import { MIN_PASSWORD } from "@/lib/customerProfile";
import { FormError, PasswordField } from "./Fields";
import { routeAfterLogin } from "./LoginForm";

export default function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("t") || "";
  const login = useCustomer((s) => s.login);
  const [check, setCheck] = useState<{ valid: boolean; email?: string; error?: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/customer/password/reset?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setCheck(d))
      .catch(() => !cancelled && setCheck({ valid: false, error: "Não foi possível conferir o link. Tente de novo." }));
    return () => { cancelled = true; };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const errs: typeof errors = {};
    if (password.length < MIN_PASSWORD) errs.password = `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres`;
    if (confirm !== password) errs.confirm = "As senhas não são iguais";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      const res = await fetch("/api/customer/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || "Não foi possível salvar a senha.");
      login(data);
      await routeAfterLogin(router, "/conta");
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (!check) return <div className="img-skeleton rounded-2xl h-72" />;

  if (!check.valid) {
    return (
      <div className="animate-fade-up">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5"><ShieldAlert size={24} /></div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">Link inválido</h1>
        <p className="text-sm text-gray-600 mt-2">{check.error}</p>
        <Link href="/conta/esqueci-senha" className="mt-7 inline-flex items-center justify-center gap-2 bg-brand text-on-button py-3 px-5 rounded-xl font-semibold">Pedir um novo link</Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">Crie uma nova senha</h1>
      <p className="text-sm text-gray-500 mt-1.5">Para a conta <strong className="text-gray-800 break-all">{check.email}</strong>.</p>

      <form onSubmit={submit} noValidate className="space-y-4 mt-7">
        <PasswordField
          label="Nova senha"
          icon={Lock}
          value={password}
          onValue={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: undefined })); }}
          error={errors.password}
          showStrength
          autoComplete="new-password"
          placeholder={`Pelo menos ${MIN_PASSWORD} caracteres`}
        />
        <PasswordField
          label="Repita a nova senha"
          icon={Lock}
          value={confirm}
          onValue={(v) => { setConfirm(v); setErrors((p) => ({ ...p, confirm: undefined })); }}
          error={errors.confirm}
          autoComplete="new-password"
          placeholder="Digite de novo"
        />
        {error && <FormError>{error}</FormError>}
        <button
          type="submit"
          disabled={loading}
          className="group w-full inline-flex items-center justify-center gap-2 bg-brand text-on-button py-3 rounded-xl font-semibold shadow-[0_10px_24px_-10px_color-mix(in_srgb,var(--button)_70%,transparent)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          {loading ? "Salvando…" : "Salvar e entrar"}
          {!loading && <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />}
        </button>
      </form>
    </div>
  );
}
