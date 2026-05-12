import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const carts = await prisma.abandonedCart.findMany({
    where: { reminderSent: false },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(carts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const cart = await prisma.abandonedCart.findUnique({ where: { id } });
  if (!cart) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
  const storeName = settings?.name || "Minha Loja";

  const items = JSON.parse(cart.cartItems) as Array<{ name: string; price: number; quantity: number }>;
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const storeUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  await sendEmail({
    to: cart.email,
    storeName,
    subject: `Você esqueceu algo na ${storeName}!`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #f0f0f0;">
        <h2 style="color:#ec4899;margin:0 0 8px;">Você esqueceu itens no carrinho!</h2>
        <p style="color:#555;margin:0 0 20px;">Ainda está pensando? Seus produtos estão esperando por você na <strong>${storeName}</strong>.</p>
        ${items.map((i) => `<p style="margin:4px 0;color:#333;">• ${i.name} × ${i.quantity}</p>`).join("")}
        <p style="margin:16px 0 0;font-size:18px;font-weight:700;color:#111;">Total: R$ ${total.toFixed(2).replace(".", ",")}</p>
        <a href="${storeUrl}/carrinho" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#ec4899;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">
          Voltar ao carrinho
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px;"><strong style="color:#ec4899;">${storeName}</strong></p>
      </div>
    `,
  });

  await prisma.abandonedCart.update({ where: { id }, data: { reminderSent: true } });
  return NextResponse.json({ ok: true });
}
