"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { useCustomer } from "@/hooks/useCustomer";

interface WaitlistFormProps {
  productId: string;
  size?: string;
  color?: string;
}

export default function WaitlistForm({ productId, size, color }: WaitlistFormProps) {
  const customer = useCustomer((s) => s.customer);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          email: customer?.email || email,
          name: customer?.name || name,
          size: size || "",
          color: color || "",
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Erro"); return; }
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  const variantLabel = [size, color].filter(Boolean).join(" / ");

  if (done) {
    return (
      <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
        <Bell size={20} className="mx-auto text-green-600 mb-2" />
        <p className="text-sm font-bold text-green-800">Avisaremos quando voltar!</p>
        <p className="text-xs text-green-600 mt-1">
          Você receberá um e-mail quando {variantLabel ? <><strong>{variantLabel}</strong> estiver disponível</> : "o produto estiver disponível"}.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Bell size={16} className="text-amber-600" />
        <p className="text-sm font-bold text-amber-800">Avise-me quando voltar</p>
      </div>
      {variantLabel && (
        <p className="text-xs text-amber-700 mb-3 ml-6">
          Variação: <strong>{variantLabel}</strong>
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-2.5">
        {!customer && (
          <>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Seu e-mail"
              className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </>
        )}
        {customer && (
          <p className="text-xs text-amber-700">Notificar em <strong>{customer.email}</strong></p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-colors disabled:opacity-60"
        >
          {loading ? "Registrando..." : "Me avise quando voltar"}
        </button>
      </form>
    </div>
  );
}
