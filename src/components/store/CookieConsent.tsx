"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Cookie } from "lucide-react";
import { CONSENT_OPEN_EVENT, getConsent, openConsentBanner, setConsent, subscribeConsent } from "@/lib/cookieConsent";

// "pending" on the server so the banner never renders in the SSR HTML.
const getServerSnapshot = () => "pending" as const;

export function CookieConsentBanner() {
  const consent = useSyncExternalStore(subscribeConsent, getConsent, getServerSnapshot);
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, []);

  if (consent === "pending" || (consent !== null && !reopened)) return null;

  const choose = (value: "accepted" | "rejected") => {
    setConsent(value);
    setReopened(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Preferências de cookies"
      className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-xl p-5 sm:flex sm:items-center sm:gap-6">
        <div className="flex gap-3 sm:flex-1">
          <Cookie size={22} className="shrink-0 text-brand mt-0.5" />
          <p className="text-sm text-gray-600 leading-relaxed">
            Usamos cookies essenciais para o funcionamento da loja e, com a sua permissão, cookies de marketing
            (Meta/Facebook) para medir e personalizar anúncios. Você pode mudar sua escolha a qualquer momento em
            &quot;Preferências de cookies&quot;, no rodapé.
          </p>
        </div>
        <div className="mt-4 flex gap-2 sm:mt-0 sm:shrink-0">
          <button
            onClick={() => choose("rejected")}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Recusar
          </button>
          <button
            onClick={() => choose("accepted")}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm font-bold bg-brand text-on-button hover:opacity-90 transition-opacity"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}

export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openConsentBanner} className={className}>
      Preferências de cookies
    </button>
  );
}
