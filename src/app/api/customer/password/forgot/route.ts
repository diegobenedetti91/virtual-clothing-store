import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { createResetToken } from "@/lib/passwordReset";
import { sendPasswordResetEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site";
import { isValidEmail } from "@/lib/customerProfile";

// Resposta sempre igual: não revela se o e-mail tem conta na loja
const DONE = { ok: true, message: "Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha." };

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !isValidEmail(email.trim())) {
    return NextResponse.json({ error: "Informe um e-mail válido" }, { status: 400 });
  }
  const normalized = email.trim().toLowerCase();

  // Evita usar a tela para mandar e-mails em massa
  const ip = clientIp(req.headers);
  if (isRateLimited(`pwreset:ip:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }
  if (isRateLimited(`pwreset:email:${normalized}`, 3, 60 * 60 * 1000)) return NextResponse.json(DONE);

  const customer = await prisma.customerUser.findUnique({ where: { email: normalized }, select: { id: true, name: true, email: true, password: true } });
  if (customer) {
    const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { name: true } });
    const link = `${siteUrl()}/conta/redefinir-senha?t=${encodeURIComponent(createResetToken(customer))}`;
    await sendPasswordResetEmail({
      to: customer.email,
      customerName: customer.name,
      storeName: settings?.name || "Minha Loja",
      link,
      hadPassword: !!customer.password,
    }).catch((e) => console.error("[password/forgot] e-mail:", e));
  }
  return NextResponse.json(DONE);
}
