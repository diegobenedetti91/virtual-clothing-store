import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromCookie } from "@/lib/customerAuth";

/** Preferências de comunicação do cliente: { promoEmails: boolean } */
export async function GET() {
  const payload = await getCustomerFromCookie();
  if (!payload) return NextResponse.json({ error: "Faça login" }, { status: 401 });
  const c = await prisma.customerUser.findUnique({ where: { id: payload.id }, select: { marketingOptOut: true } });
  return NextResponse.json({ promoEmails: !c?.marketingOptOut });
}

export async function PATCH(req: NextRequest) {
  const payload = await getCustomerFromCookie();
  if (!payload) return NextResponse.json({ error: "Faça login" }, { status: 401 });
  const { promoEmails } = (await req.json().catch(() => ({}))) as { promoEmails?: unknown };
  if (typeof promoEmails !== "boolean") return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
  await prisma.customerUser.update({ where: { id: payload.id }, data: { marketingOptOut: !promoEmails } });
  return NextResponse.json({ promoEmails });
}
