"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, Mail, User } from "lucide-react";
import { useCustomer } from "@/hooks/useCustomer";
import { MIN_PASSWORD, isValidEmail, safeRedirect, validateProfileFields, type ProfileField } from "@/lib/customerProfile";
import { Divider, Field, FormError, PasswordField } from "./Fields";
import GoogleButton, { GOOGLE_ENABLED } from "./GoogleButton";
import { AddressStep, ContactStep, ProfileSummary, Stepper, type ProfileForm, type SummarySection } from "./ProfileSteps";
import { routeAfterLogin } from "./LoginForm";

const STEPS = ["Conta", "Contato", "Endereço", "Revisão"];
type AccountErrors = { name?: string; email?: string; password?: string; confirm?: string };

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useCustomer((s) => s.login);
  const redirect = safeRedirect(searchParams.get("redirect"));
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [values, setValues] = useState<ProfileForm>({ name: "", phone: "", cpfCnpj: "", zipCode: "", street: "", number: "", neighborhood: "", city: "", state: "" });
  const [accErrors, setAccErrors] = useState<AccountErrors>({});
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [error, setError] = useState("");
  const [emailTaken, setEmailTaken] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof ProfileForm, v: string) => {
    setValues((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  /** Valida a etapa atual; devolve true se pode avançar. */
  const validateStep = (s: number) => {
    if (s === 0) {
      const e: AccountErrors = {};
      const name = values.name.trim();
      if (!name) e.name = "Informe seu nome";
      else if (name.split(/\s+/).length < 2) e.name = "Informe nome e sobrenome";
      if (!isValidEmail(email)) e.email = "Informe um e-mail válido";
      if (password.length < MIN_PASSWORD) e.password = `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres`;
      if (!confirm) e.confirm = "Repita a senha";
      else if (confirm !== password) e.confirm = "As senhas não são iguais";
      setAccErrors(e);
      return Object.keys(e).length === 0;
    }
    const keys: ProfileField[] = s === 1 ? ["phone", "cpfCnpj"] : ["zipCode", "street", "number", "neighborhood", "city", "state"];
    const e = validateProfileFields(values, keys);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep(step)) { setError(""); setStep((s) => s + 1); } };
  const goTo = (section: SummarySection) => setStep(section === "account" ? 0 : section === "contact" ? 1 : 2);

  const submit = async () => {
    // Revalida tudo antes de enviar (o cliente pode ter voltado e apagado algo)
    for (const s of [0, 1, 2]) {
      if (!validateStep(s)) { setStep(s); return; }
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, name: values.name.trim(), email: email.trim(), password, confirm }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setEmailTaken(true);
          setAccErrors({ email: "Este e-mail já tem cadastro." });
          setStep(0);
        } else if (data.fields) {
          // A API apontou campos inválidos: volta para a etapa do primeiro deles
          setErrors(data.fields);
          const first = Object.keys(data.fields)[0];
          setStep(["phone", "cpfCnpj"].includes(first) ? 1 : first === "name" ? 0 : 2);
        }
        setError(data.error || "Não foi possível criar a conta.");
        return;
      }
      login(data);
      router.push(redirect);
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
          body: JSON.stringify({ token: credential, action: "register" }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Não foi possível continuar com o Google.");
          return;
        }
        login(data);
        // Conta do Google vem só com nome e e-mail: segue para completar o resto
        await routeAfterLogin(router, redirect, data.profileComplete);
      } catch {
        setError("Não foi possível conectar com o Google. Tente novamente.");
      } finally {
        setLoading(false);
      }
    },
    [login, redirect, router]
  );

  const loginHref = searchParams.get("redirect") ? `/conta/login?redirect=${encodeURIComponent(redirect)}` : "/conta/login";

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">Criar sua conta</h1>
      <p className="text-sm text-gray-500 mt-1.5">Leva menos de 2 minutos. Seus dados ficam salvos para as próximas compras.</p>

      <div className="mt-6"><Stepper steps={STEPS} current={step} /></div>

      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); if (step < 3) next(); else submit(); }}
        className="mt-6"
      >
        {step === 0 && (
          <div key="s0" className="space-y-4 animate-fade-up [animation-duration:0.3s]">
            <GoogleButton onCredential={handleGoogle} text="signup_with" />
            {GOOGLE_ENABLED && <Divider label="ou cadastre com e-mail" />}
            <Field label="Nome completo" icon={User} autoComplete="name" placeholder="Maria Silva" value={values.name} onValue={(v) => { set("name", v); setAccErrors((p) => ({ ...p, name: undefined })); }} error={accErrors.name} />
            <Field
              label="E-mail"
              icon={Mail}
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onValue={(v) => { setEmail(v); setEmailTaken(false); setAccErrors((p) => ({ ...p, email: undefined })); }}
              error={accErrors.email}
            />
            {emailTaken && (
              <p className="-mt-2 text-xs text-gray-600">
                Já é cliente? <Link href={loginHref} className="font-semibold text-brand hover:underline">Entrar com este e-mail</Link>
              </p>
            )}
            <PasswordField label="Senha" icon={Lock} value={password} onValue={(v) => { setPassword(v); setAccErrors((p) => ({ ...p, password: undefined })); }} error={accErrors.password} showStrength autoComplete="new-password" placeholder={`Mínimo ${MIN_PASSWORD} caracteres`} id="f-senha" />
            <PasswordField label="Confirmar senha" icon={Lock} value={confirm} onValue={(v) => { setConfirm(v); setAccErrors((p) => ({ ...p, confirm: undefined })); }} error={accErrors.confirm} autoComplete="new-password" placeholder="Repita a senha" id="f-confirmar" />
          </div>
        )}
        {step === 1 && <div key="s1" className="animate-fade-up [animation-duration:0.3s]"><ContactStep values={values} set={set} errors={errors} /></div>}
        {step === 2 && <div key="s2" className="animate-fade-up [animation-duration:0.3s]"><AddressStep values={values} set={set} errors={errors} /></div>}
        {step === 3 && (
          <div key="s3" className="space-y-3 animate-fade-up [animation-duration:0.3s]">
            <p className="text-sm text-gray-600">Confira seus dados antes de concluir:</p>
            <ProfileSummary values={values} email={email} onEdit={goTo} />
          </div>
        )}

        {error && <div className="mt-4"><FormError>{error}</FormError></div>}

        <div className="mt-6 flex gap-2">
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50">
              <ArrowLeft size={16} /> Voltar
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="group flex-1 inline-flex items-center justify-center gap-2 bg-brand text-on-button py-3 rounded-xl font-semibold shadow-[0_10px_24px_-10px_color-mix(in_srgb,var(--button)_70%,transparent)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {step < 3 ? "Continuar" : loading ? "Criando conta…" : "Criar minha conta"}
            {!loading && (step < 3 ? <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" /> : <Check size={17} />)}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Já tem conta? <Link href={loginHref} className="font-semibold text-gray-900 hover:text-brand">Entrar</Link>
      </p>
    </div>
  );
}
