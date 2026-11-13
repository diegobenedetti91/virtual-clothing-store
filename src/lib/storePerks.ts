import type { CompanySettings } from "@/types";

export type PerkIcon = "pix" | "truck" | "store" | "refresh" | "card" | "shield";
export interface Perk {
  icon: PerkIcon;
  title: string;
  desc: string;
}

/**
 * Vantagens reais da loja, montadas a partir das configurações do admin
 * (só aparece o que está ativo). Usadas na faixa do topo, no menu e no rodapé.
 */
export function storePerks(s?: CompanySettings | null): Perk[] {
  const perks: Perk[] = [];
  if (s?.pixDiscountEnabled && (s.pixDiscountPercent ?? 0) > 0) {
    perks.push({ icon: "pix", title: `${s.pixDiscountPercent}% OFF no Pix`, desc: "Desconto aplicado no checkout" });
  }
  if (s?.freteAtivo && s.freteTipo === "local") {
    perks.push({ icon: "truck", title: `Entrega${s.freteLocalCidade ? ` em ${s.freteLocalCidade}` : " local"}`, desc: "Rápida e sem complicação" });
  } else {
    perks.push({ icon: "truck", title: "Enviamos para todo o Brasil", desc: "Frete calculado pelo CEP" });
  }
  if (s?.freteLocalRetirada) perks.push({ icon: "store", title: "Retire na loja", desc: "Sem custo de frete" });
  if (s?.mercadoPagoAtivo || s?.infinityPayAtivo || s?.nuPayAtivo) {
    perks.push({ icon: "card", title: "Parcele no cartão", desc: "Pix, cartão e mais formas" });
  }
  perks.push({ icon: "refresh", title: "Troca fácil", desc: "7 dias após receber para devolver" });
  perks.push({ icon: "shield", title: "Compra segura", desc: "Pagamento protegido" });
  return perks;
}

/** Link do WhatsApp da loja (com DDI do Brasil quando faltar). */
export function whatsappLink(whatsapp?: string | null, text?: string) {
  const d = (whatsapp || "").replace(/\D/g, "");
  if (!d) return null;
  return `https://wa.me/${d.length <= 11 ? "55" : ""}${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
