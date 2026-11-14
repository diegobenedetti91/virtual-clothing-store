"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { useCustomer } from "@/hooks/useCustomer";
import { isProfileComplete, isValidEmail, safeRedirect } from "@/lib/customerProfile";
import { Divider, Field, FormError, PasswordField } from "./Fields";
import GoogleButton, { GOOGLE_ENABLED } from "./GoogleButton";

const REMEMBER_KEY = "customer-login-email";

/** Depois de entrar: se faltar dado obrigatório, vai completar o cadastro antes de seguir. */
export async function routeAfterLogin(router: ReturnType<typeof useRouter>, target: string, profileComplete?: boolean) {
  let complete = profileComplete;
  if (complete === undefined) {
    try {
      const p = await fetch("/api/customer/profile").then((r) => r.json());
      complete = isProfileComplete(p);
    } catch {
      complete = true; // na dúvida não bloqueia; o checkout confere de novo
    }
  }
  router.push(complete ? target : `/conta/completar-perfil?redirect=${encodeURIComponent(target)}`);
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useCustomer((s) => s.login);
  const redirect = safeRedirect(searchParams.get("redirect"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do localStorage após a hidratação
      if (saved) setEmail(saved);
    } catch {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const errs: typeof errors = {};
    if (!isValidEmail(email)) errs.email = "Informe um e-mail válido";
    if (!password) errs.password = "Informe sua senha";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const res = await fetch("/api/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        // A API não diz se a conta foi criada pelo Google; a dica cobre esse caso
        setError(
          res.status === 401
            ? "E-mail ou senha incorretos. Se você criou a conta com o Google, entre pelo botão do Google."
            : data.error || "Não foi possível entrar."
        );
        return;
      }
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email.trim());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {}
      login(data);
      await routeAfterLogin(router, redirect);
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = useCallback(
    async (credential: string) => {
      setError("");
      setLoading(true);
      try {
        const res = await fetch("/api/customer/login-google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: credential, action: "login" }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Não foi possível entrar com o Google.");
          return;
        }
        login(data);
        await routeAfterLogin(router, redirect, data.profileComplete);
      } catch {
        setError("Não foi possível conectar com o Google. Tente novamente.");
      } finally {
        setLoading(false);
      }
    },
    [login, redirect, router]
  );

  const registerHref = searchParams.get("redirect") ? `/conta/registro?redirect=${encodeURIComponent(redirect)}` : "/conta/registro";

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">Entrar na sua conta</h1>
      <p className="text-sm text-gray-500 mt-1.5">Acompanhe pedidos, salve favoritos e compre mais rápido.</p>

      <div className="mt-7">
        <GoogleButton onCredential={handleGoogle} text="signin_with" />
      </div>
      {GOOGLE_ENABLED && <Divider label="ou entre com e-mail" />}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          label="E-mail"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onValue={(v) => { setEmail(v); setErrors((p) => ({ ...p, email: undefined })); }}
          error={errors.email}
        />
        <PasswordField
          label="Senha"
          icon={Lock}
          value={password}
          onValue={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: undefined })); }}
          error={errors.password}
          placeholder="Sua senha"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 select-none cursor-pointer">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded accent-[var(--brand)]" />
          Lembrar meu e-mail
        </label>

        {error && <FormError>{error}</FormError>}

        <button
          type="submit"
          disabled={loading}
          className="group w-full inline-flex items-center justify-center gap-2 bg-brand text-on-button py-3 rounded-xl font-semibold shadow-[0_10px_24px_-10px_color-mix(in_srgb,var(--button)_70%,transparent)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          {loading ? "Entrando…" : "Entrar"}
          {!loading && <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Ainda não tem conta?{" "}
        <Link href={registerHref} className="font-semibold text-gray-900 hover:text-brand">Criar conta grátis</Link>
      </p>
    </div>
  );
}
