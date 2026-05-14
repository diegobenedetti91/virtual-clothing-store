import { prisma } from "@/lib/prisma";

interface OrderItemLike {
  productId: string;
  quantity: number;
  size?: string | null;
  color?: string | null;
}

export async function restoreOrderStock(items: OrderItemLike[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { stock: true, variantStock: true },
      });
      if (!product) continue;

      const variants = JSON.parse(product.variantStock || "[]") as {
        size?: string;
        color?: string;
        stock: number;
      }[];

      if (variants.length > 0 && (item.size || item.color)) {
        const updated = variants.map((v) => {
          const sizeOk = item.size ? v.size === item.size : !v.size;
          const colorOk = item.color ? v.color === item.color : !v.color;
          if (sizeOk && colorOk) return { ...v, stock: v.stock + item.quantity };
          return v;
        });
        const newTotal = updated.reduce((sum, v) => sum + (v.stock || 0), 0);
        await tx.product.update({
          where: { id: item.productId },
          data: { variantStock: JSON.stringify(updated), stock: newTotal },
        });
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
  });
}
