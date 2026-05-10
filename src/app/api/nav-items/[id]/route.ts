import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const item = await prisma.navItem.update({
    where: { id },
    data: {
      ...(body.label !== undefined && { label: body.label }),
      ...(body.href !== undefined && { href: body.href }),
      ...(body.active !== undefined && { active: body.active }),
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.navItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
