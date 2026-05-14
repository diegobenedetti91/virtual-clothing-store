import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  if (!productId) return NextResponse.json({ available: 0 });

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { stock: true, variantStock: true },
  });
  if (!product) return NextResponse.json({ available: 0 });

  const variants = JSON.parse(product.variantStock || "[]") as { size?: string; color?: string; stock: number }[];
  const size = searchParams.get("size") || undefined;
  const color = searchParams.get("color") || undefined;

  if (variants.length > 0) {
    const variant = variants.find((v) => {
      const sizeOk = size ? v.size === size : !v.size;
      const colorOk = color ? v.color === color : !v.color;
      return sizeOk && colorOk;
    });
    if (variant !== undefined) {
      return NextResponse.json({ available: variant.stock });
    }
  }

  return NextResponse.json({ available: product.stock });
}
