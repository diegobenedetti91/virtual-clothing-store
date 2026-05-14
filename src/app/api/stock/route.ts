import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeVariantStock, getStockForSelection } from "@/lib/variantUtils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  if (!productId) return NextResponse.json({ available: 0 });

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { stock: true, variantStock: true },
  });
  if (!product) return NextResponse.json({ available: 0 });

  const raw = JSON.parse(product.variantStock || "[]");
  const variants = normalizeVariantStock(raw);

  if (variants.length === 0) {
    return NextResponse.json({ available: product.stock });
  }

  // Build selection from query params — new format: ?attributes={"Sabor":"Chocolate"}
  // Legacy format: ?size=P&color=Preto (backward compat for old cart items)
  const attrsParam = searchParams.get("attributes");
  let selected: Record<string, string> = {};

  if (attrsParam) {
    try { selected = JSON.parse(attrsParam); } catch { /* ignore */ }
  } else {
    const size = searchParams.get("size");
    const color = searchParams.get("color");
    if (size) selected["Tamanho"] = size;
    if (color) selected["Cor"] = color;
  }

  const available = Object.keys(selected).length > 0
    ? getStockForSelection(variants, selected)
    : product.stock;

  return NextResponse.json({ available });
}
