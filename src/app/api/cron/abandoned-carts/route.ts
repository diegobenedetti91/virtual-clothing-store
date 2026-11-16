import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendCartReminder } from "@/lib/abandonedCartReminder";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  // Aceita os dois formatos (as outras rotinas usam x-cron-secret)
  const auth = req.headers.get("authorization");
  const ok = !!CRON_SECRET && (auth === `Bearer ${CRON_SECRET}` || req.headers.get("x-cron-secret") === CRON_SECRET);

  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
    const storeName = settings?.name || "Minha Loja";

    // Find abandoned carts: not reminded in 3 hours
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const carts = await prisma.abandonedCart.findMany({
      where: {
        reminderSent: false,
        closedAt: null,
        updatedAt: { lt: threeHoursAgo },
      },
    });

    console.log(`[CRON] Found ${carts.length} abandoned carts to notify`);

    // Mesmo envio do botão do admin: respeita "não quero receber" (LGPD) e pula quem já comprou
    let sent = 0;
    const skipped: string[] = [];
    for (const cart of carts) {
      try {
        const r = await sendCartReminder(cart.id, storeName);
        if (r.sent) sent++;
        else {
          skipped.push(r.reason);
          // Não tentar de novo a cada hora: encerra o carrinho (exceto SMTP fora — tenta quando voltar)
          if (!r.reason.includes("SMTP")) {
            await prisma.abandonedCart.updateMany({ where: { id: cart.id, closedAt: null }, data: { closedAt: new Date() } }).catch(() => {});
          }
        }
      } catch (err) {
        console.error(`[CRON] Failed to send reminder to ${cart.email}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      found: carts.length,
      sent,
      skipped,
    });
  } catch (error) {
    console.error("[CRON] Abandoned carts cron error:", error);
    return NextResponse.json({
      error: "Failed to process abandoned carts",
    }, { status: 500 });
  }
}

// O agendador do servidor chama com GET (curl sem -X POST): executa a mesma rotina
export const GET = POST;
