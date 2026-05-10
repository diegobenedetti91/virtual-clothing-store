import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken, buildCookieHeader } from "@/lib/customerAuth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
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
