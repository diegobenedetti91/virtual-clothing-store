import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categorySlug = searchParams.get("category");
  const featured = searchParams.get("featured");
  const search = searchParams.get("search");
  const adminView = searchParams.get("admin");
  const menuId = searchParams.get("menu");

  const where: Record<string, unknown> = {};
  if (!adminView) where.active = true;
  if (featured === "true") where.featured = true;
  if (categorySlug) where.category = { slug: categorySlug };
  if (menuId) where.navItems = { some: { id: menuId } };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const products = await prisma.product.findMany({
    where,
    include: { category: true, navItems: { select: { id: true, label: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description, price, comparePrice, images, categoryId, sizes, colors, stock, variantStock, active, featured, navItemIds } = body;

  let slug = slugify(name);
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now()}`;

  const product = await prisma.product.create({
    data: {
      name,
      description,
      price: parseFloat(price),
      comparePrice: comparePrice ? parseFloat(comparePrice) : null,
      images: JSON.stringify(images || []),
      categoryId,
      sizes: JSON.stringify(sizes || []),
      colors: JSON.stringify(colors || []),
      stock: variantStock?.length ? variantStock.reduce((s: number, v: { stock: number }) => s + (v.stock || 0), 0) : parseInt(stock) || 0,
      variantStock: JSON.stringify(variantStock || []),
      active: active !== false,
      featured: featured === true,
      slug,
      navItems: navItemIds?.length ? { connect: navItemIds.map((id: string) => ({ id })) } : undefined,
    },
    include: { category: true, navItems: { select: { id: true, label: true } } },
  });

  return NextResponse.json(product, { status: 201 });
}
