import { prisma } from "@/lib/prisma";

export async function getBlingProdutoIdForVariant(
  productId: string,
  size: string | null
): Promise<string | null> {
  if (!size) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { blingProdutoId: true },
    });
    return product?.blingProdutoId || null;
  }

  const variantMap = await prisma.productVariantBlingMap.findUnique({
    where: {
      productId_size: {
        productId,
        size,
      },
    },
    select: { blingProdutoId: true },
  });

  return variantMap?.blingProdutoId || null;
}

export async function getOrCreateBlingVariantMapping(
  productId: string,
  size: string,
  blingProdutoId: string
) {
  return await prisma.productVariantBlingMap.upsert({
    where: {
      productId_size: {
        productId,
        size,
      },
    },
    update: { blingProdutoId },
    create: {
      productId,
      size,
      blingProdutoId,
    },
  });
}

export async function listBlingVariantMappings(productId: string) {
  return await prisma.productVariantBlingMap.findMany({
    where: { productId },
    orderBy: { size: "asc" },
  });
}

export async function deleteBlingVariantMapping(productId: string, size: string) {
  return await prisma.productVariantBlingMap.delete({
    where: {
      productId_size: {
        productId,
        size,
      },
    },
  });
}
