import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, image, active } = body;

  let slug = slugify(name);
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now()}`;

  const category = await prisma.category.create({
    data: { name, slug, image, active: active !== false },
    include: { _count: { select: { products: true } } },
  });

  return NextResponse.json(category, { status: 201 });
}
