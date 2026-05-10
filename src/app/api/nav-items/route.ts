import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.navItem.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { label, href } = await req.json();
  if (!label) {
    return NextResponse.json({ error: "label obrigatório" }, { status: 400 });
  }
  const count = await prisma.navItem.count();
  // Create first to get the ID, then set href if not provided
  const item = await prisma.navItem.create({
    data: { label: label.trim(), href: href?.trim() || "__auto__", position: count },
  });
  // If no href provided, use auto-generated products filter URL
  if (!href?.trim() || href.trim() === "__auto__") {
    const updated = await prisma.navItem.update({
      where: { id: item.id },
      data: { href: `/produtos?menu=${item.id}` },
      include: { _count: { select: { products: true } } },
    });
    return NextResponse.json(updated, { status: 201 });
  }
  return NextResponse.json({ ...item, _count: { products: 0 } }, { status: 201 });
}
