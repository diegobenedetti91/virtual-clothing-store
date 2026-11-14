import { applyFlashSales } from "@/lib/flashSales";
import { NextRequest, NextResponse, after } from "next/server";
import { autoNotify } from "@/lib/promoInterest";
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

  // Preço anterior: se baixou, avisa os interessados (automático) ou devolve para o admin perguntar
  const before = await prisma.product.findUnique({ where: { id }, select: { price: true } });

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

  let priceDropped: { from: number; to: number; autoNotify: boolean } | null = null;
  if (before && product.price < before.price - 0.009 && product.active) {
    const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { promoAutoNotify: true } });
    const auto = !!settings?.promoAutoNotify;
    priceDropped = { from: before.price, to: product.price, autoNotify: auto };
    if (auto) {
      const task = () => autoNotify({ productId: id, reason: "PRICE_DROP", priceBefore: before.price });
      try { after(task); } catch { void task(); }
    }
  }

  return NextResponse.json({ ...product, priceDropped });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
