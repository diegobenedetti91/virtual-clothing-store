import { normalizeCouponCode } from "@/lib/coupons";

const TYPES = ["PERCENT", "FIXED", "FREE_SHIPPING"] as const;

export interface CouponData {
  code: string;
  description: string | null;
  type: string;
  value: number;
  maxDiscount: number | null;
  minOrderValue: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  firstPurchaseOnly: boolean;
  stackWithPix: boolean;
  showInChat: boolean;
  productIds: string | null;
  categoryIds: string | null;
  active: boolean;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const date = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? new Date(NaN) : d;
};
const ids = (v: unknown): string | null => {
  if (!Array.isArray(v)) return null;
  const list = v.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, 500);
  return list.length ? JSON.stringify(list) : null;
};

/** Valida o corpo enviado pelo admin e devolve os dados prontos para o Prisma. */
export function parseCouponInput(body: unknown): { data: CouponData } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Dados inválidos" };
  const b = body as Record<string, unknown>;

  const code = normalizeCouponCode(b.code);
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return { error: "O código deve ter de 3 a 40 letras, números, - ou _" };

  const type = String(b.type || "PERCENT");
  if (!TYPES.includes(type as (typeof TYPES)[number])) return { error: "Tipo de cupom inválido" };

  const value = type === "FREE_SHIPPING" ? 0 : num(b.value);
  if (value === null || Number.isNaN(value) || (type !== "FREE_SHIPPING" && value <= 0)) return { error: "Informe o valor do desconto" };
  if (type === "PERCENT" && value > 100) return { error: "A porcentagem não pode passar de 100%" };

  const maxDiscount = type === "PERCENT" ? num(b.maxDiscount) : null;
  const minOrderValue = num(b.minOrderValue);
  const usageLimit = num(b.usageLimit);
  const perCustomerLimit = num(b.perCustomerLimit);
  for (const [label, v] of [["Teto do desconto", maxDiscount], ["Pedido mínimo", minOrderValue], ["Limite de usos", usageLimit], ["Usos por cliente", perCustomerLimit]] as const) {
    if (v !== null && (Number.isNaN(v) || v < 0)) return { error: `${label} inválido` };
  }

  const startsAt = date(b.startsAt);
  const endsAt = date(b.endsAt);
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) return { error: "Data inválida" };
  if (startsAt && endsAt && endsAt <= startsAt) return { error: "A data final precisa ser depois da inicial" };

  return {
    data: {
      code,
      description: typeof b.description === "string" && b.description.trim() ? b.description.trim().slice(0, 190) : null,
      type,
      value: value ?? 0,
      maxDiscount: maxDiscount || null,
      minOrderValue: minOrderValue || null,
      startsAt,
      endsAt,
      usageLimit: usageLimit != null ? Math.floor(usageLimit) || null : null,
      perCustomerLimit: perCustomerLimit != null ? Math.floor(perCustomerLimit) || null : null,
      firstPurchaseOnly: b.firstPurchaseOnly === true,
      stackWithPix: b.stackWithPix === true,
      showInChat: b.showInChat === true,
      productIds: ids(b.productIds),
      categoryIds: ids(b.categoryIds),
      active: b.active !== false,
    },
  };
}
