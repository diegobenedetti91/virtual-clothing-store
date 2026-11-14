import { NextRequest, NextResponse } from "next/server";
import { processarEtiquetasPendentes } from "@/lib/labelPipeline";

/** Rotina: tenta de novo etiquetas travadas (ex.: sem saldo no Melhor Envio) e conclui as que faltam gerar/baixar. */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await processarEtiquetasPendentes());
  } catch (e) {
    console.error("[cron/etiquetas]", e);
    return NextResponse.json({ error: "Falha ao processar etiquetas" }, { status: 500 });
  }
}
