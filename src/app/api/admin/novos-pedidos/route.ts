import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getNewOrders, markOrdersSeen } from "@/lib/newOrders";

/** Pedidos pagos ainda não vistos + andamento da automação (consultado a cada poucos segundos pelo admin). */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const data = await getNewOrders();
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

/** { ids?: string[] } — marca como vistos (sem ids: todos). */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { ids } = (await req.json().catch(() => ({}))) as { ids?: string[] };
  await markOrdersSeen(Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : undefined);
  return NextResponse.json({ ok: true });
}
