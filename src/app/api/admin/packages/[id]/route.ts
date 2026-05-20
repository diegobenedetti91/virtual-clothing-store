import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { name, comprimento, largura, altura, pesoGramas, active } = await req.json();

  const pkg = await prisma.packagePreset.update({
    where: { id },
    data: {
      name,
      comprimento: parseInt(comprimento),
      largura: parseInt(largura),
      altura: parseInt(altura),
      pesoGramas: parseInt(pesoGramas) || 0,
      active: active !== false,
    },
  });

  return NextResponse.json(pkg);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Unlink products before deleting
  await prisma.product.updateMany({ where: { embalagemId: id }, data: { embalagemId: null } });
  await prisma.packagePreset.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
