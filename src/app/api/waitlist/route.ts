import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromRequest } from "@/lib/customerAuth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");

  const where = productId ? { productId } : {};
  const entries = await prisma.waitlistEntry.findMany({
    where,
    include: { product: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const customer = getCustomerFromRequest(req);
  const { productId, email, name, size, color } = await req.json();

  const resolvedEmail = customer?.email || email?.trim();
  const resolvedName = customer?.name || name?.trim();
  const resolvedSize = size?.trim() || "";
  const resolvedColor = color?.trim() || "";

  if (!productId || !resolvedEmail) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  try {
    await prisma.waitlistEntry.upsert({
      where: {
        productId_email_size_color: {
          productId,
          email: resolvedEmail,
          size: resolvedSize,
          color: resolvedColor,
        },
      },
      update: { notified: false },
      create: {
        productId,
        email: resolvedEmail,
        name: resolvedName || null,
        size: resolvedSize,
        color: resolvedColor,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro ao entrar na lista de espera" }, { status: 500 });
  }
}
