"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, Loader2, User } from "lucide-react";
import { useCustomer } from "@/hooks/useCustomer";
import {
  REQUIRED_PROFILE_FIELDS, fieldFormatError, maskCep, maskCpfCnpj, maskPhone, missingProfileFields, safeRedirect, validateProfileFields,
  type ProfileField,
} from "@/lib/customerProfile";
import { Field, FormError } from "./Fields";
import { AddressStep, ContactStep, ProfileSummary, Stepper, type ProfileForm, type SummarySection } from "./ProfileSteps";

const STEPS = ["Seus dados", "Endereço", "Revisão"];
const STEP_FIELDS: ProfileField[][] = [["name", "phone", "cpfCnpj"], ["zipCode", "street", "number", "neighborhood", "city", "state"]];

/** Completar cadastro (contas do Google ou cadastros antigos): mostra o que já tem e o que falta. */
export default function CompleteProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customer = useCustomer((s) => s.customer);
  const customerLoading = useCustomer((s) => s.loading);
  const redirect = safeRedirect(searchParams.get("redirect"));
  const [values, setValues] = useState<ProfileForm>({ name: "", phone: "", cpfCnpj: "", zipCode: "", street: "", number: "", neighborhood: "", city: "", state: "" });
  const [loaded, setLoaded] = useState(false);
  const [initialMissing, setInitialMissing] = useState<ProfileField[]>([]);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customerLoading) return;
    if (!customer) {
      router.replace(`/conta/login?redirect=${encodeURIComponent(`/conta/completar-perfil?redirect=${encodeURIComponent(redirect)}`)}`);
      return;
    }
    let cancelled = false;
    fetch("/api/customer/profile")
      .then((r) => r.json())
      .then((p) => {
        if (cancelled || !p) return;
        const v: ProfileForm = {
          name: p.name || customer.name || "",
          phone: p.phone ? maskPhone(p.phone) : "",
          cpfCnpj: p.cpfCnpj ? maskCpfCnpj(p.cpfCnpj) : "",
          zipCode: p.zipCode ? maskCep(p.zipCode) : "",
          street: p.street || "",
          number: p.number || "",
          neighborhood: p.neighborhood || "",
          city: p.city || "",
          state: (p.state || "").toUpperCase(),
        };
        // "Falta" = vazio ou com formato inválido (ex.: CPF digitado errado em cadastro antigo)
        const missing = REQUIRED_PROFILE_FIELDS.map((f) => f.key).filter((k) => missingProfileFields(v).includes(k) || !!fieldFormatError(k, v[k]));
        setValues(v);
        setInitialMissing(missing);
        // Começa na primeira etapa que tem pendência; se nada falta, vai para a revisão
        setStep(missing.some((k) => STEP_FIELDS[0].includes(k)) ? 0 : missing.length ? 1 : 2);
        setLoaded(true);
      })
      .catch(() => !cancelled && setLoaded(true));
    return () => { cancelled = true; };
  }, [customer, customerLoading, redirect, router]);

  const set = (k: keyof ProfileForm, v: string) => {
    setValues((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const validateStep = (s: number) => {
    const e = validateProfileFields(values, STEP_FIELDS[s]);
    if (s === 0 && !e.name && values.name.trim().split(/\s+/).length < 2) e.name = "Informe nome e sobrenome";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goTo = (section: SummarySection) => setStep(section === "address" ? 1 : 0);

  const save = async () => {
    for (const s of [0, 1]) {
      if (!validateStep(s)) { setStep(s); return; }
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, name: values.name.trim(), requireComplete: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fields) {
          setErrors(data.fields);
          setStep(Object.keys(data.fields).some((k) => STEP_FIELDS[0].includes(k as ProfileField)) ? 0 : 1);
        }
        setError(data.error || "Não foi possível salvar seus dados.");
        return;
      }
      router.push(redirect);
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="space-y-3">
        <div className="img-skeleton rounded-xl h-8 w-2/3" />
        <div className="img-skeleton rounded-2xl h-40" />
        <div className="img-skeleton rounded-2xl h-56" />
      </div>
    );
  }

  const filledCount = REQUIRED_PROFILE_FIELDS.length - initialMissing.length;

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">Complete seu cadastro</h1>
      <p className="text-sm text-gray-500 mt-1.5">
        {initialMissing.length
          ? "Faltam alguns dados para entregarmos seus pedidos e emitirmos a nota fiscal."
          : "Tudo certo! Confira seus dados e continue."}
      </p>

      {/* O que já tem e o que falta */}
      <div className="mt-5 rounded-2xl bg-gray-50 ring-1 ring-gray-100 p-4">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>{customer?.email}</span>
          <span className="tabular-nums">{filledCount}/{REQUIRED_PROFILE_FIELDS.length} preenchidos</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden mb-3">
          <div className="h-full bg-brand rounded-full transition-[width] duration-700" style={{ width: `${(filledCount / REQUIRED_PROFILE_FIELDS.length) * 100}%` }} />
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
          {REQUIRED_PROFILE_FIELDS.map((f) => {
            const ok = !initialMissing.includes(f.key);
            return (
              <li key={f.key} className={`flex items-center gap-1.5 text-xs ${ok ? "text-gray-500" : "text-gray-900 font-medium"}`}>
                {ok ? <CheckCircle2 size={13} className="text-emerald-600 shrink-0" /> : <Circle size={13} className="text-amber-500 shrink-0" />}
                {f.label}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-6"><Stepper steps={STEPS} current={step} /></div>

      <form noValidate onSubmit={(e) => { e.preventDefault(); if (step < 2) { if (validateStep(step)) setStep(step + 1); } else save(); }} className="mt-6">
        {step === 0 && (
          <div key="c0" className="space-y-4 animate-fade-up [animation-duration:0.3s]">
            <Field label="Nome completo" icon={User} autoComplete="name" placeholder="Maria Silva" value={values.name} onValue={(v) => set("name", v)} error={errors.name} />
            <ContactStep values={values} set={set} errors={errors} />
          </div>
        )}
        {step === 1 && <div key="c1" className="animate-fade-up [animation-duration:0.3s]"><AddressStep values={values} set={set} errors={errors} /></div>}
        {step === 2 && (
          <div key="c2" className="space-y-3 animate-fade-up [animation-duration:0.3s]">
            <p className="text-sm text-gray-600">Confira seus dados:</p>
            <ProfileSummary values={values} email={customer?.email} onEdit={goTo} />
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
            disabled={saving}
            className="group flex-1 inline-flex items-center justify-center gap-2 bg-brand text-on-button py-3 rounded-xl font-semibold shadow-[0_10px_24px_-10px_color-mix(in_srgb,var(--button)_70%,transparent)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {step < 2 ? "Continuar" : saving ? "Salvando…" : redirect === "/checkout" ? "Salvar e voltar ao checkout" : "Salvar e continuar"}
            {!saving && (step < 2 ? <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" /> : <Check size={17} />)}
          </button>
        </div>
      </form>
    </div>
  );
}
