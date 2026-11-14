import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { obterEtiquetaParaImprimir, prepararEtiqueta } from "@/lib/labelPipeline";

type Ctx = { params: Promise<{ id: string }> };

/** Abre a etiqueta (PDF) para imprimir e marca como impressa. Sem PDF, redireciona ao link do Melhor Envio. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const r = await obterEtiquetaParaImprimir(id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 404 });
  await prisma.order.update({ where: { id }, data: { labelPrintedAt: new Date() } });
  if (r.url && !r.pdf) return NextResponse.redirect(r.url);
  return new NextResponse(new Uint8Array(r.pdf!), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${r.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Prepara (ou continua) a etiqueta: cria, paga, gera o rastreio e salva o PDF. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const r = await prepararEtiqueta(id);
  return NextResponse.json(r, { status: r.ok ? 200 : 422 });
}
