import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const packages = await prisma.packagePreset.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return NextResponse.json(packages);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, comprimento, largura, altura, pesoGramas } = await req.json();

  if (!name || !comprimento || !largura || !altura) {
    return NextResponse.json({ error: "Campos obrigatórios: nome, comprimento, largura, altura" }, { status: 400 });
  }

  const pkg = await prisma.packagePreset.create({
    data: {
      name,
      comprimento: parseInt(comprimento),
      largura: parseInt(largura),
      altura: parseInt(altura),
      pesoGramas: parseInt(pesoGramas) || 0,
    },
  });

  return NextResponse.json(pkg, { status: 201 });
}
