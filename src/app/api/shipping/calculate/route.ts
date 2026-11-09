import { NextRequest, NextResponse } from "next/server";
import { calculateShipping } from "@/lib/shippingCalc";

export async function POST(req: NextRequest) {
  const { cepDestino, items } = await req.json().catch(() => ({}));
  const result = await calculateShipping(cepDestino, Array.isArray(items) ? items : undefined);
  return NextResponse.json(result.body, { status: result.status });
}
