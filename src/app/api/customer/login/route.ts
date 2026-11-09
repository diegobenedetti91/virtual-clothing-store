import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken, buildCookieHeader } from "@/lib/customerAuth";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  // Brute-force protection: per IP and per account
  const ip = clientIp(req.headers);
  if (isRateLimited(`login:ip:${ip}`, 20, 15 * 60 * 1000) || isRateLimited(`login:email:${email.toLowerCase()}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  const customer = await prisma.customerUser.findUnique({ where: { email } });
  if (!customer) {
    return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, customer.password);
  if (!valid) {
    return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 });
  }

  const token = signToken({ id: customer.id, email: customer.email, name: customer.name });
  const res = NextResponse.json({ id: customer.id, email: customer.email, name: customer.name });
  res.headers.set("Set-Cookie", buildCookieHeader(token));
  return res;
}
