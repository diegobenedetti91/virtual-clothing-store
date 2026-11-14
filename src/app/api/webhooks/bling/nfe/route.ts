import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consultarNfe } from "@/lib/blingNfe";

/**
 * Webhook "Nota fiscal" (invoice) do Bling: avisa quando a situação da nota muda.
 * Autenticado pelo cabeçalho X-Bling-Signature-256 (HMAC-SHA256 do corpo com o Client Secret do app).
 * O payload só serve para achar a nota: a situação é sempre conferida direto na API.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { blingClientSecret: true } });
  const secret = settings?.blingClientSecret;
  const given = req.headers.get("x-bling-signature-256") || "";
  if (!secret) return NextResponse.json({ error: "Bling não configurado" }, { status: 400 });
  const expected = `sha256=${createHmac("sha256", secret).update(raw, "utf8").digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });

  let body: { event?: string; data?: { id?: number | string } };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  const nfeId = body.data?.id != null ? String(body.data.id) : null;
  if (!nfeId || !body.event?.startsWith("invoice.")) return NextResponse.json({ ok: true, ignored: true });

  const order = await prisma.order.findFirst({ where: { nfeId }, select: { id: true } });
  // Nota que não saiu do site (emitida à mão no Bling): nada a fazer
  if (!order) return NextResponse.json({ ok: true, ignored: true });

  if (body.event === "invoice.deleted") {
    // Nota excluída no Bling (ex.: rejeitada e apagada para refazer): o pedido volta a ficar sem nota
    await prisma.order.update({
      where: { id: order.id },
      data: { nfeId: null, nfeStatus: null, nfeSituacao: null, nfeNumero: null, nfeSerie: null, nfeChave: null, nfeError: null },
    });
    return NextResponse.json({ ok: true, removed: true });
  }

  const result = await consultarNfe(order.id);
  return NextResponse.json({ ok: true, status: result.status });
}
