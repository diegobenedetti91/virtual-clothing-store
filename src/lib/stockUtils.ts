import { prisma } from "@/lib/prisma";
import { normalizeVariantStock, matchesSelection } from "@/lib/variantUtils";

interface OrderItemLike {
  productId: string;
  quantity: number;
  // Legacy
  size?: string | null;
  color?: string | null;
  // New
  selectedAttributes?: string | null;
}

function parseSelected(item: OrderItemLike): Record<string, string> | null {
  if (item.selectedAttributes) {
    try { return JSON.parse(item.selectedAttributes); } catch { /* fall through */ }
  }
  // Legacy
  if (item.size || item.color) {
    const attrs: Record<string, string> = {};
    if (item.size) attrs["Tamanho"] = item.size;
    if (item.color) attrs["Cor"] = item.color;
    return attrs;
  }
  return null;
}

export async function decrementOrderStock(items: OrderItemLike[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { stock: true, variantStock: true },
      });
      if (!product) continue;

      const raw = JSON.parse(product.variantStock || "[]");
      const variants = normalizeVariantStock(raw);
      const selected = parseSelected(item);

      if (variants.length > 0 && selected) {
        const updated = variants.map((v) =>
          matchesSelection(v.attributes, selected)
            ? { ...v, stock: Math.max(0, v.stock - item.quantity) }
            : v
        );
        const newTotal = updated.reduce((sum, v) => sum + (v.stock || 0), 0);
        await tx.product.update({
          where: { id: item.productId },
          data: { variantStock: JSON.stringify(updated), stock: newTotal },
        });
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
    }
  });
}

export async function restoreOrderStock(items: OrderItemLike[]): Promise<void> {
  console.log("[RESTORE] Starting stock restoration for items:", JSON.stringify(items));

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { stock: true, variantStock: true },
      });
      if (!product) {
        console.warn("[RESTORE] Product not found:", item.productId);
        continue;
      }

      console.log("[RESTORE] Before restoration - Product:", item.productId, "Current stock:", product.stock, "Quantity to restore:", item.quantity);

      const raw = JSON.parse(product.variantStock || "[]");
      const variants = normalizeVariantStock(raw);
      const selected = parseSelected(item);

      if (variants.length > 0 && selected) {
        console.log("[RESTORE] Has variants with selection");
        const updated = variants.map((v) =>
          matchesSelection(v.attributes, selected)
            ? { ...v, stock: v.stock + item.quantity }
            : v
        );
        const newTotal = updated.reduce((sum, v) => sum + (v.stock || 0), 0);
        console.log("[RESTORE] After restoration - New total stock:", newTotal);
        await tx.product.update({
          where: { id: item.productId },
          data: { variantStock: JSON.stringify(updated), stock: newTotal },
        });
      } else {
        console.log("[RESTORE] No variants, incrementing total stock by:", item.quantity);
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
  });

  console.log("[RESTORE] ✓ Stock restoration completed");
}
