import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromCookie } from "@/lib/customerAuth";

export async function GET() {
  const payload = await getCustomerFromCookie();
  if (!payload) return NextResponse.json([]);

  const items = await prisma.wishlistItem.findMany({
    where: { customerId: payload.id },
    include: { product: { include: { category: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const payload = await getCustomerFromCookie();
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { productId } = await req.json();
  if (!productId) return NextResponse.json({ error: "productId obrigatório" }, { status: 400 });

  const item = await prisma.wishlistItem.upsert({
    where: { customerId_productId: { customerId: payload.id, productId } },
    create: { customerId: payload.id, productId },
    update: {},
  });
  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const payload = await getCustomerFromCookie();
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { productId } = await req.json();
  await prisma.wishlistItem.deleteMany({
    where: { customerId: payload.id, productId },
  });
  return NextResponse.json({ ok: true });
}
