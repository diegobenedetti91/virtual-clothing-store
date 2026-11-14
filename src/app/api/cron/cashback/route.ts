import { NextRequest, NextResponse } from "next/server";
import { processCashbackNotifications } from "@/lib/cashback";

/** Rotina: e-mails de cashback liberado e de crédito vencendo. */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await processCashbackNotifications());
  } catch (e) {
    console.error("[cron/cashback]", e);
    return NextResponse.json({ error: "Falha ao processar cashback" }, { status: 500 });
  }
}
