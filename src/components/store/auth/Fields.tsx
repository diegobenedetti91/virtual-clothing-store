"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { passwordStrength } from "@/lib/customerProfile";

type IconType = React.ComponentType<{ size?: number; className?: string }>;

export const inputBase =
  "w-full rounded-xl border bg-white py-3 text-sm text-gray-900 placeholder:text-gray-400 transition focus:outline-none";

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: string;
  icon?: IconType;
  error?: string | null;
  hint?: string;
  onValue: (v: string) => void;
  right?: React.ReactNode;
}

/** Campo com rótulo, ícone, erro no próprio campo e dica. */
export function Field({ label, icon: Icon, error, hint, onValue, right, id, className = "", ...rest }: FieldProps) {
  const fieldId = id || `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        {Icon && <Icon size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${error ? "text-red-400" : "text-gray-400"}`} />}
        <input
          id={fieldId}
          {...rest}
          onChange={(e) => onValue(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-err` : undefined}
          className={`${inputBase} ${Icon ? "pl-10" : "pl-4"} ${right ? "pr-11" : "pr-4"} ${error ? "border-red-300 bg-red-50/40" : "border-gray-200"}`}
        />
        {right && <div className="absolute right-2 top-1/2 -translate-y-1/2">{right}</div>}
      </div>
      {error ? (
        <p id={`${fieldId}-err`} className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
}

/** Senha com mostrar/ocultar, aviso de Caps Lock e (opcional) medidor de força. */
export function PasswordField({ label, value, onValue, error, icon, showStrength = false, autoComplete = "current-password", placeholder, id }: {
  label: string; value: string; onValue: (v: string) => void; error?: string | null; icon?: IconType; showStrength?: boolean; autoComplete?: string; placeholder?: string; id?: string;
}) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const strength = passwordStrength(value);
  const colors = ["bg-red-500", "bg-red-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"];
  const check = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.("CapsLock") ?? false);
  return (
    <div>
      <Field
        id={id}
        label={label}
        icon={icon}
        type={show ? "text" : "password"}
        value={value}
        onValue={onValue}
        error={error}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onKeyUp={check}
        onKeyDown={check}
        right={
          <button type="button" onClick={() => setShow((v) => !v)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100" aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
      />
      {caps && <p className="mt-1 text-xs text-amber-700">Caps Lock está ligado.</p>}
      {showStrength && value && (
        <div className="mt-2">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < Math.max(1, strength.score) ? colors[strength.score] : "bg-gray-200"}`} />
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">Força: <b className="text-gray-700">{strength.label}</b> · use 8+ caracteres, misture letras, números e símbolos</p>
        </div>
      )}
    </div>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-red-700 bg-red-50 ring-1 ring-red-100 rounded-xl px-3.5 py-2.5" role="alert">{children}</p>;
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
      <div className="relative flex justify-center"><span className="bg-white px-3 text-xs uppercase tracking-wider text-gray-400">{label}</span></div>
    </div>
  );
}
