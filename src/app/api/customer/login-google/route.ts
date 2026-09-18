import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, buildCookieHeader } from "@/lib/customerAuth";
import { OAuth2Client } from "google-auth-library";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

export async function POST(req: NextRequest) {
  const { token: idToken, action } = await req.json();

  if (!idToken) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }

  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: "Google não está configurado" },
      { status: 500 }
    );
  }

  try {
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const { email, name, picture } = payload;

    if (!email) {
      return NextResponse.json({ error: "E-mail não encontrado" }, { status: 400 });
    }

    let customer = await prisma.customerUser.findUnique({ where: { email } });

    if (!customer) {
      if (action !== "register") {
        return NextResponse.json(
          { error: "Conta não encontrada. Crie uma nova conta." },
          { status: 404 }
        );
      }

      // Create new customer from Google signup
      customer = await prisma.customerUser.create({
        data: {
          email,
          name: name || email.split("@")[0],
          password: "", // OAuth users don't have password
          phone: "",
          cpfCnpj: "",
          street: "",
          number: "",
          neighborhood: "",
          city: "",
          state: "",
          zipCode: "",
        },
      });
    }

    const token = signToken({ id: customer.id, email: customer.email, name: customer.name });
    const res = NextResponse.json({
      id: customer.id,
      email: customer.email,
      name: customer.name,
    });
    res.headers.set("Set-Cookie", buildCookieHeader(token));
    return res;
  } catch (error) {
    console.error("[login-google] error:", error);
    return NextResponse.json(
      { error: "Erro ao autenticar com Google" },
      { status: 401 }
    );
  }
}
