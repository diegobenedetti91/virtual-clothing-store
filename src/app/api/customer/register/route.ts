import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken, buildCookieHeader } from "@/lib/customerAuth";
import { sincronizarClienteComBling } from "@/lib/blingSync";

export async function POST(req: NextRequest) {
  console.log("[register] ========== ENDPOINT CHAMADO ==========");
  console.log("[register] URL:", req.url);
  console.log("[register] Method:", req.method);

  try {
    console.log("[register] Lendo JSON do body...");
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

    console.log("[register] Dados recebidos:", {
      name,
      email,
      phone,
      cpfCnpj,
    });

    // Validar campos obrigatórios
    console.log("[register] Validando campos...");
    if (!name || !email || !password || !phone || !cpfCnpj || !street || !number || !neighborhood || !city || !state || !zipCode) {
      console.error("[register] Campos obrigatórios faltando");
      return NextResponse.json({ error: "Todos os campos são obrigatórios" }, { status: 400 });
    }

    console.log("[register] Verificando e-mail duplicado...");
    const existing = await prisma.customerUser.findUnique({ where: { email } });
    if (existing) {
      console.warn("[register] E-mail já cadastrado:", email);
      return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
    }

    console.log("[register] Hashando senha...");
    const hashed = await bcrypt.hash(password, 10);

    console.log("[register] Criando cliente no banco...");
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

    console.log("[register] ✓ Cliente criado com ID:", customer.id);
    console.log("[register] Iniciando sincronização com Bling...");
    sincronizarClienteComBling(customer.id)
      .then((success) => {
        if (success) {
          console.log("[Bling] Cliente sincronizado automaticamente ao registrar:", customer.id);
        } else {
          console.warn("[Bling] Falha ao sincronizar cliente novo:", customer.id);
        }
      })
      .catch((err) => {
        console.error("[Bling] Erro ao sincronizar cliente novo:", customer.id, err);
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
