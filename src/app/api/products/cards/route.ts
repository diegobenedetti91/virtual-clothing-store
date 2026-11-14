import { NextRequest, NextResponse } from "next/server";
import { getProductCards } from "@/lib/productCards";

/** Cards de produtos por id (ex.: "Vistos recentemente"). ?ids=a,b,c */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") || "").split(",").filter(Boolean);
  const products = await getProductCards(ids);
  return NextResponse.json({ products }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
