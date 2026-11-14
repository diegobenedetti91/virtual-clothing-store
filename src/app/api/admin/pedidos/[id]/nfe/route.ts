import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { acompanharNfe, baixarDocumentoNfe, consultarNfe, emitirNfe, sendNfeEmail } from "@/lib/blingNfe";

type Ctx = { params: Promise<{ id: string }> };

/** Baixa o DANFE (?formato=pdf) ou o XML (?formato=xml) da nota do pedido. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const formato = req.nextUrl.searchParams.get("formato") === "xml" ? "xml" : "pdf";
  const order = await prisma.order.findUnique({ where: { id }, select: { nfeChave: true, nfeStatus: true } });
  if (!order?.nfeChave || order.nfeStatus !== "authorized") return NextResponse.json({ error: "Nota não autorizada" }, { status: 404 });
  const doc = await baixarDocumentoNfe(order.nfeChave, formato);
  if (!doc) return NextResponse.json({ error: "Não foi possível baixar o documento no Bling" }, { status: 502 });
  return new NextResponse(new Uint8Array(doc.buffer), {
    headers: {
      "Content-Type": formato === "pdf" ? "application/pdf" : "application/xml",
      "Content-Disposition": `${formato === "pdf" ? "inline" : "attachment"}; filename="${doc.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Ações do admin: { action: "emitir" | "consultar" | "email" } */
export async function POST(req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };

  if (action === "emitir") {
    const r = await emitirNfe(id);
    if (r.status === "processing" || r.status === "pending") acompanharNfe(id);
    return NextResponse.json(r, { status: r.ok ? 200 : 422 });
  }
  if (action === "consultar") {
    const r = await consultarNfe(id);
    return NextResponse.json(r, { status: r.ok ? 200 : 422 });
  }
  if (action === "email") {
    try {
      const sent = await sendNfeEmail(id, true);
      return sent
        ? NextResponse.json({ ok: true, message: "E-mail com a nota reenviado ao cliente" })
        : NextResponse.json({ ok: false, message: "Nota não autorizada ou pedido sem e-mail" }, { status: 422 });
    } catch (e) {
      return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Falha ao enviar" }, { status: 502 });
    }
  }
  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
