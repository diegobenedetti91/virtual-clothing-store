"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Mail, MailCheck } from "lucide-react";
import { isValidEmail } from "@/lib/customerProfile";
import { Field, FormError } from "./Fields";

export default function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isValidEmail(email)) return setFieldError("Informe um e-mail válido");
    setLoading(true);
    try {
      const res = await fetch("/api/customer/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || "Não foi possível enviar agora. Tente de novo.");
      setSentTo(email.trim());
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <div className="animate-fade-up">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5"><MailCheck size={24} /></div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">Confira seu e-mail</h1>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Se houver uma conta com <strong className="text-gray-900 break-all">{sentTo}</strong>, você vai receber um link para criar uma nova senha.
          O link vale por 1 hora.
        </p>
        <p className="text-sm text-gray-500 mt-3">Não chegou em alguns minutos? Veja a caixa de spam ou promoções.</p>
        <div className="mt-7 flex flex-col sm:flex-row gap-3">
          <Link href="/conta/login" className="inline-flex items-center justify-center gap-2 bg-brand text-on-button py-3 px-5 rounded-xl font-semibold">Voltar para o login</Link>
          <button type="button" onClick={() => setSentTo(null)} className="inline-flex items-center justify-center py-3 px-5 rounded-xl font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50">Usar outro e-mail</button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <Link href="/conta/login" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft size={15} /> Voltar</Link>
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">Esqueceu sua senha?</h1>
      <p className="text-sm text-gray-500 mt-1.5">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>

      <form onSubmit={submit} noValidate className="space-y-4 mt-7">
        <Field
          label="E-mail"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onValue={(v) => { setEmail(v); setFieldError(undefined); }}
          error={fieldError}
        />
        {error && <FormError>{error}</FormError>}
        <button
          type="submit"
          disabled={loading}
          className="group w-full inline-flex items-center justify-center gap-2 bg-brand text-on-button py-3 rounded-xl font-semibold shadow-[0_10px_24px_-10px_color-mix(in_srgb,var(--button)_70%,transparent)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          {loading ? "Enviando…" : "Enviar link"}
          {!loading && <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />}
        </button>
      </form>
    </div>
  );
}
