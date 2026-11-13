import { prisma } from "@/lib/prisma";

export interface ActiveFlashSale {
  id: string;
  title: string;
  endAt: Date;
  discountType: string;
  discountValue: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function flashPrice(price: number, sale: Pick<ActiveFlashSale, "discountType" | "discountValue">) {
  const p = sale.discountType === "FIXED" ? price - sale.discountValue : price * (1 - sale.discountValue / 100);
  return Math.max(0.01, round2(p));
}

/** Promoção ativa agora para cada produto (se houver mais de uma, vale a de maior desconto). */
export async function getActiveFlashSales(productIds: string[]): Promise<Map<string, ActiveFlashSale>> {
  const map = new Map<string, ActiveFlashSale>();
  if (productIds.length === 0) return map;
  const now = new Date();
  const sales = await prisma.flashSale.findMany({
    where: { active: true, startAt: { lte: now }, endAt: { gte: now }, productId: { in: [...new Set(productIds)] } },
    include: { product: { select: { price: true } } },
  });
  for (const s of sales) {
    if (!s.productId || !s.product) continue;
    const current = map.get(s.productId);
    if (!current || flashPrice(s.product.price, s) < flashPrice(s.product.price, current)) {
      map.set(s.productId, { id: s.id, title: s.title, endAt: s.endAt, discountType: s.discountType, discountValue: s.discountValue });
    }
  }
  return map;
}

/**
 * Aplica as promoções relâmpago ativas: `price` vira o preço promocional,
 * `comparePrice` mostra o preço "de" e `flashSale` traz título e fim (para o cronômetro).
 * Usado na vitrine e no checkout, então o cliente paga exatamente o que viu.
 */
export async function applyFlashSales<T extends { id: string; price: number; comparePrice?: number | null }>(
  products: T[]
): Promise<(T & { flashSale?: { id: string; title: string; endAt: string } })[]> {
  const sales = await getActiveFlashSales(products.map((p) => p.id));
  if (sales.size === 0) return products;
  return products.map((p) => {
    const sale = sales.get(p.id);
    if (!sale) return p;
    return {
      ...p,
      price: flashPrice(p.price, sale),
      comparePrice: Math.max(p.price, p.comparePrice ?? 0),
      flashSale: { id: sale.id, title: sale.title, endAt: sale.endAt.toISOString() },
    };
  });
}
