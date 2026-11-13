import { applyFlashSales } from "@/lib/flashSales";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true, navItems: { select: { id: true, label: true } } },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ((await auth())?.user) return NextResponse.json(product);
  if (!product.active) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { costPrice: _cost, ...publicProduct } = product;
  // Vitrine (favoritos, carrinho) recebe o preço com promoção relâmpago aplicada
  const [withFlash] = await applyFlashSales([publicProduct]);
  return NextResponse.json(withFlash);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const { name, description, price, comparePrice, costPrice, pesoGramas, embalagemId, measurements, blingProdutoId, images, categoryId, attributes, stock, variantStock, active, featured, navItemIds } = body;

  let slug = slugify(name);
  const existing = await prisma.product.findFirst({ where: { slug, NOT: { id } } });
  if (existing) slug = `${slug}-${Date.now()}`;

  const totalStock = variantStock?.length
    ? variantStock.reduce((s: number, v: { stock: number }) => s + (v.stock || 0), 0)
    : parseInt(stock) || 0;

  const product = await prisma.product.update({
    where: { id },
    data: {
      name,
      description,
      price: parseFloat(price),
      comparePrice: comparePrice ? parseFloat(comparePrice) : null,
      costPrice: costPrice ? parseFloat(costPrice) : null,
      pesoGramas: pesoGramas ? parseInt(pesoGramas) : null,
      embalagemId: embalagemId || null,
      measurements: typeof measurements === "string" && measurements.trim() ? measurements.trim().slice(0, 4000) : null,
      blingProdutoId: blingProdutoId || null,
      images: JSON.stringify(images || []),
      categoryId,
      sizes: "[]",
      colors: "[]",
      attributes: JSON.stringify(attributes || []),
      stock: totalStock,
      variantStock: JSON.stringify(variantStock || []),
      active: active !== false,
      featured: featured === true,
      slug,
      navItems: {
        set: navItemIds?.length ? navItemIds.map((nid: string) => ({ id: nid })) : [],
      },
    },
    include: { category: true, navItems: { select: { id: true, label: true } } },
  });

  return NextResponse.json(product);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
