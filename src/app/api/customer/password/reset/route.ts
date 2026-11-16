import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { verifyResetToken } from "@/lib/passwordReset";
import { MIN_PASSWORD } from "@/lib/customerProfile";
import { signToken, buildCookieHeader } from "@/lib/customerAuth";

const INVALID = "Este link expirou ou já foi usado. Peça um novo em “Esqueci minha senha”.";

/** GET ?t=… → o link ainda vale? (a página mostra o formulário ou o aviso de link vencido) */
export async function GET(req: NextRequest) {
  const customer = await verifyResetToken(req.nextUrl.searchParams.get("t"));
  return NextResponse.json(customer ? { valid: true, email: customer.email } : { valid: false, error: INVALID });
}

/** POST { token, password } → troca a senha e já entra na conta. */
export async function POST(req: NextRequest) {
  if (isRateLimited(`pwreset-confirm:${clientIp(req.headers)}`, 20, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }
  const { token, password } = await req.json().catch(() => ({}));
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres` }, { status: 400 });
  }
  const customer = await verifyResetToken(token);
  if (!customer) return NextResponse.json({ error: INVALID }, { status: 400 });

  const hashed = await bcrypt.hash(password, 10);
  // Condicional ao hash antigo: dois envios do mesmo link não trocam duas vezes
  const changed = await prisma.customerUser.updateMany({ where: { id: customer.id, password: customer.password }, data: { password: hashed } });
  if (changed.count === 0) return NextResponse.json({ error: INVALID }, { status: 400 });

  const res = NextResponse.json({ id: customer.id, email: customer.email, name: customer.name });
  res.headers.set("Set-Cookie", buildCookieHeader(signToken({ id: customer.id, email: customer.email, name: customer.name })));
  return res;
}
