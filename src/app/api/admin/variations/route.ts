import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const templates = await prisma.variationTemplate.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const { name, values } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }
  try {
    const template = await prisma.variationTemplate.create({
      data: {
        name: name.trim(),
        values: JSON.stringify(values || []),
      },
    });
    return NextResponse.json(template, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Nome já cadastrado" }, { status: 409 });
  }
}

export async function PUT(req: NextRequest) {
  const { id, name, values, active } = await req.json();
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  try {
    const template = await prisma.variationTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(values !== undefined ? { values: JSON.stringify(values) } : {}),
        ...(active !== undefined ? { active } : {}),
      },
    });
    return NextResponse.json(template);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  await prisma.variationTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
