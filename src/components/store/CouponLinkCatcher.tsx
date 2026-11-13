"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Tag, X } from "lucide-react";

export const PENDING_COUPON_KEY = "pending-coupon";

/**
 * Links de divulgação como loja.com/?cupom=BEMVINDO10 guardam o cupom
 * para ser aplicado automaticamente no checkout.
 */
export default function CouponLinkCatcher() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [toast, setToast] = useState<string | null>(null);

  const fromLink = (searchParams.get("cupom") || searchParams.get("coupon") || "").trim().toUpperCase().replace(/\s+/g, "").slice(0, 40);

  useEffect(() => {
    if (!fromLink) return;
    try { localStorage.setItem(PENDING_COUPON_KEY, fromLink); } catch {}
    // Tira o parâmetro da barra de endereço sem recarregar
    const url = new URL(window.location.href);
    url.searchParams.delete("cupom");
    url.searchParams.delete("coupon");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    const show = setTimeout(() => setToast(fromLink), 0);
    const hide = setTimeout(() => setToast(null), 6000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [fromLink, pathname]);

  if (!toast) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[70] w-[calc(100%-32px)] max-w-sm animate-fade-up">
      <div className="flex items-start gap-3 rounded-2xl bg-gray-900 text-white px-4 py-3 shadow-2xl">
        <span className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center shrink-0">
          <Tag size={15} />
        </span>
        <div className="text-sm flex-1">
          <p className="font-semibold">Cupom {toast} guardado!</p>
          <p className="text-white/70 text-xs mt-0.5">Ele será aplicado automaticamente no checkout.</p>
        </div>
        <button onClick={() => setToast(null)} className="p-1 -mr-1 text-white/60 hover:text-white" aria-label="Fechar">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
