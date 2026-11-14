import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromCookie } from "@/lib/customerAuth";
import { baixarDocumentoNfe } from "@/lib/blingNfe";

/** O próprio cliente baixa a nota do pedido: ?formato=pdf (DANFE) ou xml. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getCustomerFromCookie();
  if (!payload) return NextResponse.json({ error: "Faça login para baixar a nota" }, { status: 401 });

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { customerId: true, customerEmail: true, nfeChave: true, nfeStatus: true },
  });
  const owns =
    !!order && (order.customerId === payload.id || (!!order.customerEmail && order.customerEmail.toLowerCase() === payload.email.toLowerCase()));
  if (!order || !owns || order.nfeStatus !== "authorized" || !order.nfeChave) {
    return NextResponse.json({ error: "Nota fiscal não disponível" }, { status: 404 });
  }

  const formato = req.nextUrl.searchParams.get("formato") === "xml" ? "xml" : "pdf";
  const doc = await baixarDocumentoNfe(order.nfeChave, formato);
  if (!doc) return NextResponse.json({ error: "Não foi possível baixar a nota agora. Tente em alguns minutos." }, { status: 502 });
  return new NextResponse(new Uint8Array(doc.buffer), {
    headers: {
      "Content-Type": formato === "pdf" ? "application/pdf" : "application/xml",
      "Content-Disposition": `${formato === "pdf" ? "inline" : "attachment"}; filename="${doc.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
