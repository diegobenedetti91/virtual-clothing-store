import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/promoInterest";

/** Link "não quero receber promoções" (LGPD): marca o cliente e confirma numa página simples. */
export async function GET(req: NextRequest) {
  const id = verifyUnsubscribeToken(req.nextUrl.searchParams.get("t") || "");
  let ok = false;
  if (id) {
    const r = await prisma.customerUser.updateMany({ where: { id }, data: { marketingOptOut: true } });
    ok = r.count > 0;
  }
  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { name: true } });
  const store = (settings?.name || "Loja").replace(/[<>&"]/g, "");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${store}</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#f6f7f9;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;">
<div style="background:#fff;border-radius:16px;padding:32px 28px;max-width:420px;text-align:center;box-shadow:0 10px 30px -10px rgba(0,0,0,.15);">
<h1 style="font-size:20px;margin:0 0 8px;color:#111;">${ok ? "Pronto, você não vai mais receber promoções" : "Link inválido ou expirado"}</h1>
<p style="color:#555;font-size:14px;margin:0 0 20px;">${ok ? "Continuaremos enviando só os e-mails do seu pedido (confirmação, envio, nota fiscal). Se mudar de ideia, é só ativar de novo em Minha conta." : "Se quiser parar de receber promoções, entre em Minha conta → Meus dados."}</p>
<a href="/" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 20px;border-radius:10px;font-size:14px;font-weight:600;">Voltar para a ${store}</a>
</div></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
