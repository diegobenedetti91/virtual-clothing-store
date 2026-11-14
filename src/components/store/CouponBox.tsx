"use client";

import { useState } from "react";
import { Check, Loader2, Tag, X } from "lucide-react";

interface Props {
  /** Código aplicado (ou null) */
  code: string | null;
  loading: boolean;
  /** Mensagem do servidor quando o cupom está valendo */
  message: string | null;
  /** Motivo de o cupom não valer (expirado, mínimo, etc.) */
  error: string | null;
  onApply: (code: string) => void;
  onRemove: () => void;
}

/** "Tenho um cupom" — o desconto é sempre calculado no servidor. */
export default function CouponBox({ code, loading, message, error, onApply, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  if (code) {
    const valid = !error;
    return (
      <div
        className={`rounded-xl px-3 py-2.5 text-sm ring-1 transition-colors ${
          loading ? "bg-gray-50 ring-gray-200" : valid ? "bg-green-50 ring-green-200" : "bg-red-50 ring-red-200"
        }`}
      >
        <div className="flex items-center gap-2">
          {loading ? (
            <Loader2 size={15} className="animate-spin text-gray-400 shrink-0" />
          ) : valid ? (
            <Check size={15} className="text-green-600 shrink-0" />
          ) : (
            <Tag size={15} className="text-red-500 shrink-0" />
          )}
          <span className={`font-bold tracking-wide ${valid ? "text-green-800" : "text-red-700"}`}>{code}</span>
          <button
            type="button"
            onClick={() => { onRemove(); setValue(""); }}
            className="ml-auto p-1 -mr-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70"
            aria-label="Remover cupom"
          >
            <X size={14} />
          </button>
        </div>
        {!loading && (message || error) && (
          <p className={`mt-1 text-xs ${valid ? "text-green-700" : "text-red-600"}`}>{valid ? message : error}</p>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
      >
        <Tag size={14} /> Tenho um cupom de desconto
      </button>
    );
  }

  const submit = () => {
    const c = value.trim();
    if (c) onApply(c);
  };

  return (
    <div className="flex gap-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        placeholder="CÓDIGO DO CUPOM"
        maxLength={40}
        className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold tracking-wide uppercase placeholder:font-normal placeholder:tracking-normal"
        aria-label="Código do cupom"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim()}
        className="px-4 py-2 rounded-xl bg-brand text-on-button hover:bg-brand-hover text-sm font-semibold disabled:opacity-40 transition-colors"
      >
        Aplicar
      </button>
    </div>
  );
}
