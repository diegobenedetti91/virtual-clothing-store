import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");

  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
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
        updatedAt: { lt: threeHoursAgo },
      },
    });

    console.log(`[CRON] Found ${carts.length} abandoned carts to notify`);

    let sent = 0;
    for (const cart of carts) {
      try {
        const items = JSON.parse(cart.cartItems) as Array<{ name: string; price: number; quantity: number }>;
        const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        const itemsHtml = items
          .map((item) => `<li>${item.name} (x${item.quantity}) - R$ ${item.price.toFixed(2)}</li>`)
          .join("");

        const html = `
          <p>Olá,</p>
          <p>Notamos que você deixou alguns itens no seu carrinho. Não perca essa oportunidade!</p>
          <h3>Itens no carrinho:</h3>
          <ul>${itemsHtml}</ul>
          <p><strong>Total: R$ ${total.toFixed(2)}</strong></p>
          <p><a href="${process.env.NEXT_PUBLIC_STORE_URL || 'https://localhost:3000'}/carrinho" style="background: #ec4899; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Voltar ao carrinho</a></p>
          <p>Obrigado,<br/>${storeName}</p>
        `;

        await sendEmail({
          to: cart.email,
          subject: `Seus itens estão esperando no carrinho - ${storeName}`,
          html,
          storeName,
        });

        await prisma.abandonedCart.update({
          where: { id: cart.id },
          data: { reminderSent: true },
        });

        sent++;
        console.log(`[CRON] Sent reminder email to ${cart.email}`);
      } catch (err) {
        console.error(`[CRON] Failed to send reminder to ${cart.email}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      found: carts.length,
      sent,
    });
  } catch (error) {
    console.error("[CRON] Abandoned carts cron error:", error);
    return NextResponse.json({
      error: "Failed to process abandoned carts",
      details: String(error),
    }, { status: 500 });
  }
}

// Allow GET for monitoring/health checks
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");

  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ status: "ready" });
}
