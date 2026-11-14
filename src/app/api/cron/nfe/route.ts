import { NextRequest, NextResponse } from "next/server";
import { processarNfesPendentes } from "@/lib/blingNfe";

/** Rotina (a cada ~10 min): confere notas aguardando a SEFAZ, refaz emissões que falharam e e-mails pendentes. */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await processarNfesPendentes());
  } catch (e) {
    console.error("[cron/nfe]", e);
    return NextResponse.json({ error: "Falha ao processar notas" }, { status: 500 });
  }
}
