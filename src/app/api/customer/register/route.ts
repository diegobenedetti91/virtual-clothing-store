import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken, buildCookieHeader } from "@/lib/customerAuth";

export async function POST(req: NextRequest) {
  try {
    const {
      name,
      email,
      password,
      phone,
      cpfCnpj,
      street,
      number,
      neighborhood,
      city,
      state,
      zipCode,
    } = await req.json();

    // Validar campos obrigatórios
    if (!name || !email || !password || !phone || !cpfCnpj || !street || !number || !neighborhood || !city || !state || !zipCode) {
      return NextResponse.json({ error: "Todos os campos são obrigatórios" }, { status: 400 });
    }

    const existing = await prisma.customerUser.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const customer = await prisma.customerUser.create({
      data: {
        name,
        email,
        password: hashed,
        phone,
        cpfCnpj,
        street,
        number,
        neighborhood,
        city,
        state,
        zipCode,
      },
    });

    const token = signToken({ id: customer.id, email: customer.email, name: customer.name });
    const res = NextResponse.json({ id: customer.id, email: customer.email, name: customer.name });
    res.headers.set("Set-Cookie", buildCookieHeader(token));
    return res;
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
  }
}
