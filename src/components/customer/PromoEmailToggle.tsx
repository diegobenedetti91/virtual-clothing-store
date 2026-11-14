"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";

/** "Receber promoções por e-mail" na conta do cliente (o mesmo que o link de descadastro desliga). */
export default function PromoEmailToggle() {
  const [on, setOn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/customer/preferences").then((r) => (r.ok ? r.json() : null)).then((d) => { if (!cancelled && d) setOn(!!d.promoEmails); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const toggle = async () => {
    if (on == null) return;
    const next = !on;
    setOn(next);
    setSaving(true);
    const r = await fetch("/api/customer/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promoEmails: next }) }).catch(() => null);
    if (!r?.ok) setOn(!next);
    setSaving(false);
  };
  if (on == null) return null;
  return (
    <section className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
      <div className="flex items-start gap-3">
        <Mail size={16} className="text-gray-400 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-gray-900">Promoções por e-mail</h2>
          <p className="text-sm text-gray-500 mt-0.5">Avisamos quando uma peça que você olhou baixar de preço ou entrar em promoção — no máximo 3 e-mails por mês. Os e-mails do seu pedido continuam chegando normalmente.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Receber promoções por e-mail"
          onClick={toggle}
          disabled={saving}
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${on ? "bg-brand" : "bg-gray-300"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
        </button>
      </div>
    </section>
  );
}
