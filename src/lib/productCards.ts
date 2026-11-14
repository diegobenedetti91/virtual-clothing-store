import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyFlashSales } from "@/lib/flashSales";
import { PAID_STATUSES } from "@/lib/profit";
import type { Product } from "@/types";

/** Só o que o card da vitrine usa (sem descrição, que é texto pesado). */
export const CARD_SELECT = {
  id: true, name: true, slug: true, price: true, comparePrice: true, images: true, stock: true,
  featured: true, attributes: true, variantStock: true, createdAt: true, categoryId: true,
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductSelect;

const MAX_IDS = 24;
const cleanIds = (ids: string[]) => [...new Set(ids.filter((id) => typeof id === "string" && /^[\w-]{1,40}$/.test(id)))].slice(0, MAX_IDS);

/** Cards dos produtos pedidos, na mesma ordem, só os ativos, com promoção relâmpago aplicada. */
export async function getProductCards(ids: string[]): Promise<Product[]> {
  const wanted = cleanIds(ids);
  if (!wanted.length) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: wanted }, active: true }, select: CARD_SELECT });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = wanted.map((id) => byId.get(id)).filter((r) => r != null);
  return (await applyFlashSales(ordered)) as unknown as Product[];
}

/**
 * "Combina com": produtos para sugerir junto dos produtos de origem (página do produto ou carrinho).
 *  1. Comprados juntos em pedidos pagos (o que os clientes realmente levam junto)
 *  2. Mesma categoria (destaques e novidades primeiro)
 *  3. Destaques/novidades da loja, para completar
 * Só produtos ativos e com estoque; nunca repete os de origem.
 */
export async function getRelatedProducts(sourceIds: string[], limit = 8): Promise<Product[]> {
  const source = cleanIds(sourceIds);
  if (!source.length) return [];
  const picked: string[] = [];
  const skip = () => [...source, ...picked];
  const available: Prisma.ProductWhereInput = { active: true, stock: { gt: 0 } };

  const together = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      productId: { notIn: source },
      product: available,
      order: { status: { in: PAID_STATUSES }, items: { some: { productId: { in: source } } } },
    },
    _count: { productId: true },
    orderBy: { _count: { productId: "desc" } },
    take: limit,
  });
  picked.push(...together.map((t) => t.productId));

  if (picked.length < limit) {
    const cats = await prisma.product.findMany({ where: { id: { in: source } }, select: { categoryId: true } });
    const sameCategory = await prisma.product.findMany({
      where: { ...available, categoryId: { in: [...new Set(cats.map((c) => c.categoryId))] }, id: { notIn: skip() } },
      select: { id: true },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: limit - picked.length,
    });
    picked.push(...sameCategory.map((p) => p.id));
  }

  if (picked.length < limit) {
    const fill = await prisma.product.findMany({
      where: { ...available, id: { notIn: skip() } },
      select: { id: true },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: limit - picked.length,
    });
    picked.push(...fill.map((p) => p.id));
  }

  return getProductCards(picked);
}
