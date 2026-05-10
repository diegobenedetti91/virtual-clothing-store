import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, image, active } = body;

  let slug = slugify(name);
  const existing = await prisma.category.findFirst({ where: { slug, NOT: { id } } });
  if (existing) slug = `${slug}-${Date.now()}`;

  const category = await prisma.category.update({
    where: { id },
    data: { name, slug, image, active: active !== false },
    include: { _count: { select: { products: true } } },
  });

  return NextResponse.json(category);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
