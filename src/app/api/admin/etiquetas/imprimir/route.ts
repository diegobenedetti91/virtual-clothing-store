import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { obterEtiquetasEmLote } from "@/lib/labelPipeline";

/** Junta as etiquetas dos pedidos escolhidos num PDF só: { orderIds: string[] } */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { orderIds } = (await req.json().catch(() => ({}))) as { orderIds?: string[] };
  if (!Array.isArray(orderIds) || orderIds.length === 0) return NextResponse.json({ error: "Escolha ao menos um pedido" }, { status: 400 });
  const r = await obterEtiquetasEmLote(orderIds.filter((x) => typeof x === "string"));
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 422 });
  if (r.pdf) {
    return new NextResponse(new Uint8Array(r.pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="etiquetas-${r.count}.pdf"`, "Cache-Control": "private, no-store", "X-Label-Count": String(r.count) },
    });
  }
  return NextResponse.json({ url: r.url, count: r.count });
}
