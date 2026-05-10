import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromRequest } from "@/lib/customerAuth";

export async function POST(req: NextRequest) {
  const customer = getCustomerFromRequest(req);
  const { productId, email, name } = await req.json();

  const resolvedEmail = customer?.email || email?.trim();
  const resolvedName = customer?.name || name?.trim();

  if (!productId || !resolvedEmail) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  try {
    await prisma.waitlistEntry.upsert({
      where: { productId_email: { productId, email: resolvedEmail } },
      update: { notified: false },
      create: { productId, email: resolvedEmail, name: resolvedName || null },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro ao entrar na lista de espera" }, { status: 500 });
  }
}
