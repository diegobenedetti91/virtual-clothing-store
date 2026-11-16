import { NextRequest, NextResponse } from "next/server";
import { expirePendingOrders } from "@/lib/expirePendingOrders";

export const dynamic = "force-dynamic";

/** Rotina (a cada hora): cancela pedidos de gateway aguardando pagamento há mais de 24h, conferindo antes no gateway. */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const ok = !!secret && (req.headers.get("x-cron-secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await expirePendingOrders());
  } catch (e) {
    console.error("[cron/expire-pending]", e);
    return NextResponse.json({ error: "Falha ao expirar pedidos" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
