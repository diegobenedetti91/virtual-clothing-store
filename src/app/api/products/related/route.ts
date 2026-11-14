import { NextRequest, NextResponse } from "next/server";
import { getRelatedProducts } from "@/lib/productCards";

/** Sugestões "Combina com" para um ou mais produtos (ex.: itens do carrinho). ?ids=a,b&limit=8 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ids = (sp.get("ids") || "").split(",").filter(Boolean);
  const limit = Math.min(12, Math.max(1, Number(sp.get("limit")) || 8));
  const products = await getRelatedProducts(ids, limit);
  return NextResponse.json({ products }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } });
}
