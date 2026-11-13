"use client";

import { useRef, useState } from "react";
import { Building2, Check, Hash, Home, IdCard, Loader2, MapPin, Phone } from "lucide-react";
import { Field, inputBase } from "./Fields";
import { UF_LIST, maskCep, maskCpfCnpj, maskPhone, onlyDigits, type ProfileField } from "@/lib/customerProfile";

export interface ProfileForm {
  name: string;
  phone: string;
  cpfCnpj: string;
  zipCode: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
}
type Errors = Partial<Record<ProfileField, string>>;
type SetField = (k: keyof ProfileForm, v: string) => void;

/** Etapa "Contato e documento": celular e CPF/CNPJ com máscara. */
export function ContactStep({ values, set, errors }: { values: ProfileForm; set: SetField; errors: Errors }) {
  return (
    <div className="space-y-4">
      <Field
        label="Celular / WhatsApp"
        icon={Phone}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="(11) 99999-9999"
        value={values.phone}
        onValue={(v) => set("phone", maskPhone(v))}
        error={errors.phone}
        hint="Usamos para avisos do pedido e da entrega."
      />
      <Field
        label="CPF ou CNPJ"
        icon={IdCard}
        inputMode="numeric"
        placeholder="000.000.000-00"
        value={values.cpfCnpj}
        onValue={(v) => set("cpfCnpj", maskCpfCnpj(v))}
        error={errors.cpfCnpj}
        hint="Obrigatório para a nota fiscal e o envio."
      />
    </div>
  );
}

/** Etapa "Endereço": CEP primeiro, preenchimento automático pelo ViaCEP. */
export function AddressStep({ values, set, errors }: { values: ProfileForm; set: SetField; errors: Errors }) {
  const [cepState, setCepState] = useState<"idle" | "loading" | "found" | "notfound">("idle");
  const numberRef = useRef<HTMLInputElement>(null);
  const lastCep = useRef("");

  const lookup = async (cep: string) => {
    const d = onlyDigits(cep);
    if (d.length !== 8 || d === lastCep.current) return;
    lastCep.current = d;
    setCepState("loading");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      if (!res.ok || data.erro) throw new Error("not found");
      if (data.logradouro) set("street", data.logradouro);
      if (data.bairro) set("neighborhood", data.bairro);
      if (data.localidade) set("city", data.localidade);
      if (data.uf) set("state", data.uf);
      setCepState("found");
      setTimeout(() => numberRef.current?.focus(), 50);
    } catch {
      // Sem internet ou CEP desconhecido: o cliente preenche à mão
      setCepState("notfound");
    }
  };

  return (
    <div className="space-y-4">
      <Field
        label="CEP"
        icon={MapPin}
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder="00000-000"
        value={values.zipCode}
        onValue={(v) => {
          const m = maskCep(v);
          set("zipCode", m);
          if (onlyDigits(m).length === 8) lookup(m);
        }}
        error={errors.zipCode}
        right={
          cepState === "loading" ? <Loader2 size={16} className="mr-1.5 animate-spin text-gray-400" /> : cepState === "found" ? <Check size={16} className="mr-1.5 text-emerald-600" /> : undefined
        }
        hint={
          cepState === "notfound"
            ? "Não encontramos esse CEP — preencha o endereço abaixo."
            : cepState === "found"
              ? "Endereço encontrado. Confira e informe o número."
              : "Digite o CEP e preenchemos o endereço para você."
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
        <Field label="Rua / Avenida" icon={Home} autoComplete="address-line1" placeholder="Rua das Flores" value={values.street} onValue={(v) => set("street", v)} error={errors.street} />
        <div>
          <label htmlFor="f-numero" className="block text-sm font-medium text-gray-700 mb-1.5">Número</label>
          <div className="relative">
            <Hash size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${errors.number ? "text-red-400" : "text-gray-400"}`} />
            <input
              id="f-numero"
              ref={numberRef}
              value={values.number}
              onChange={(e) => set("number", e.target.value)}
              placeholder="123"
              autoComplete="address-line2"
              aria-invalid={!!errors.number}
              className={`${inputBase} pl-10 pr-3 ${errors.number ? "border-red-300 bg-red-50/40" : "border-gray-200"}`}
            />
          </div>
          {errors.number && <p className="mt-1.5 text-xs text-red-600">{errors.number}</p>}
        </div>
      </div>
      <Field label="Bairro" icon={Building2} placeholder="Centro" value={values.neighborhood} onValue={(v) => set("neighborhood", v)} error={errors.neighborhood} />
      <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
        <Field label="Cidade" icon={Building2} autoComplete="address-level2" placeholder="São Paulo" value={values.city} onValue={(v) => set("city", v)} error={errors.city} />
        <div>
          <label htmlFor="f-uf" className="block text-sm font-medium text-gray-700 mb-1.5">UF</label>
          <select
            id="f-uf"
            value={values.state}
            onChange={(e) => set("state", e.target.value)}
            autoComplete="address-level1"
            aria-invalid={!!errors.state}
            className={`${inputBase} px-3 ${errors.state ? "border-red-300 bg-red-50/40" : "border-gray-200"}`}
          >
            <option value="">—</option>
            {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
          {errors.state && <p className="mt-1.5 text-xs text-red-600">{errors.state}</p>}
        </div>
      </div>
    </div>
  );
}

/** Indicador de etapas. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Etapas do cadastro">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center gap-2 flex-1 min-w-0">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition ${done ? "bg-brand text-white" : active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"}`}>
              {done ? <Check size={14} /> : i + 1}
            </span>
            <span className={`text-xs truncate ${active ? "font-semibold text-gray-900" : done ? "text-gray-600" : "text-gray-400"}`}>{s}</span>
            {i < steps.length - 1 && <span className={`hidden sm:block h-px flex-1 ${done ? "bg-brand" : "bg-gray-200"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Resumo dos dados antes de concluir. */
export type SummarySection = "account" | "contact" | "address";
export function ProfileSummary({ values, email, onEdit }: { values: ProfileForm; email?: string; onEdit: (section: SummarySection) => void }) {
  const rows: { label: string; value: string; step: SummarySection }[] = [
    { label: "Nome", value: values.name, step: "account" },
    ...(email ? [{ label: "E-mail", value: email, step: "account" as const }] : []),
    { label: "Celular", value: values.phone, step: "contact" },
    { label: "CPF/CNPJ", value: values.cpfCnpj, step: "contact" },
    {
      label: "Endereço",
      value: `${values.street}, ${values.number} — ${values.neighborhood}, ${values.city}/${values.state} · CEP ${values.zipCode}`,
      step: "address",
    },
  ];
  return (
    <dl className="rounded-2xl ring-1 ring-gray-200 divide-y divide-gray-100">
      {rows.map((r) => (
        <div key={r.label} className="flex items-start gap-3 px-4 py-3 text-sm">
          <dt className="w-20 shrink-0 text-gray-500">{r.label}</dt>
          <dd className="flex-1 min-w-0 text-gray-900 break-words">{r.value}</dd>
          <button type="button" onClick={() => onEdit(r.step)} className="text-xs font-medium text-brand hover:underline shrink-0">Editar</button>
        </div>
      ))}
    </dl>
  );
}
