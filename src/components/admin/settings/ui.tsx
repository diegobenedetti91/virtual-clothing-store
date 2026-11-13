"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Peças visuais compartilhadas pelas seções de Configurações. */

export const inputClass =
  "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-400 transition";
export const labelClass = "block text-[13px] font-medium text-gray-700 mb-1.5";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full shrink-0 transition-colors ${checked ? "bg-brand" : "bg-gray-300"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
    </button>
  );
}

/** Linha com título, explicação e interruptor à direita. */
export function ToggleRow({ title, hint, checked, onChange }: { title: string; hint?: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

/** Campo de chave/segredo com botão de mostrar/ocultar. */
export function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} pr-10 font-mono`}
        placeholder={placeholder}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
        aria-label={show ? "Ocultar" : "Mostrar"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export type Status = "active" | "testing" | "missing" | "off";
const STATUS: Record<Status, { label: string; tone: string }> = {
  active: { label: "Ativo", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  testing: { label: "Ativo · testes", tone: "bg-blue-50 text-blue-700 ring-blue-200" },
  missing: { label: "Faltando chave", tone: "bg-amber-50 text-amber-800 ring-amber-200" },
  off: { label: "Desligado", tone: "bg-gray-100 text-gray-500 ring-gray-200" },
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${s.tone}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "active" ? "bg-emerald-500" : status === "testing" ? "bg-blue-500" : status === "missing" ? "bg-amber-500" : "bg-gray-400"}`} />
      {label ?? s.label}
    </span>
  );
}

/** Calcula o selo de uma integração a partir de "ligado" e "tem as chaves". */
export const statusOf = (on: boolean, configured: boolean, testing = false): Status =>
  !on ? "off" : !configured ? "missing" : testing ? "testing" : "active";

export function Card({ title, description, icon, action, children }: { title: string; description?: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="flex items-start gap-3 px-5 pt-5">
        {icon && <span className="w-9 h-9 rounded-xl bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center shrink-0 text-lg">{icon}</span>}
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children && <div className="px-5 pb-5 pt-4 space-y-4">{children}</div>}
      {!children && <div className="pb-5" />}
    </section>
  );
}

/** Card de integração: cabeçalho com selo + interruptor; corpo só aparece quando ligada. */
export function IntegrationCard({
  title, description, icon, status, on, onToggle, children,
}: {
  title: string; description: React.ReactNode; icon: React.ReactNode; status: Status; on?: boolean; onToggle?: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <Card
      title={title}
      description={description}
      icon={icon}
      action={
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          {onToggle && <Toggle checked={!!on} onChange={onToggle} label={`Ativar ${title}`} />}
        </div>
      }
    >
      {(onToggle ? on : true) && children}
    </Card>
  );
}

export function Hint({ tone = "gray", children }: { tone?: "gray" | "amber" | "blue" | "green"; children: React.ReactNode }) {
  const tones = {
    gray: "bg-gray-50 text-gray-600",
    amber: "bg-amber-50 text-amber-800",
    blue: "bg-blue-50 text-blue-800",
    green: "bg-emerald-50 text-emerald-800",
  };
  return <div className={`rounded-xl px-3.5 py-3 text-xs leading-relaxed ${tones[tone]}`}>{children}</div>;
}
