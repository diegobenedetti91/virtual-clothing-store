"use client";

import { confirmDialog, notify } from "@/lib/notify";

/**
 * Depois de baixar o preço ou criar uma promoção relâmpago (com o aviso automático desligado):
 * mostra quantos interessados podem ser avisados e, se o admin confirmar, envia.
 */
export async function askToNotifyInterested(productId: string, reason: "PRICE_DROP" | "FLASH_SALE", opts: { priceBefore?: number; flashSaleId?: string } = {}) {
  try {
    const qs = new URLSearchParams({ motivo: reason, ...(opts.priceBefore ? { de: String(opts.priceBefore) } : {}) });
    const r = await fetch(`/api/admin/interesse/${productId}?${qs}`);
    if (!r.ok) return;
    const d = await r.json();
    const eligible: number = d?.audience?.eligible ?? 0;
    if (!eligible || !d.offer || "error" in d.offer) return;
    const ok = await confirmDialog({
      title: `Avisar ${eligible} cliente${eligible === 1 ? "" : "s"} interessado${eligible === 1 ? "" : "s"}?`,
      message: `${d.offer.headline}. Eles viram, favoritaram ou deixaram este produto no carrinho e ainda não compraram. Cada cliente recebe no máximo ${d.limit.perCustomer} e-mails de promoção a cada ${d.limit.days} dias.`,
      confirmText: "Enviar aviso",
      cancelText: "Agora não",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/interesse/${productId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, priceBefore: opts.priceBefore, flashSaleId: opts.flashSaleId }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) notify.success(j.message || "Aviso enviado");
    else notify.warning("Não foi possível enviar o aviso", { description: j.message || j.error });
  } catch {}
}
