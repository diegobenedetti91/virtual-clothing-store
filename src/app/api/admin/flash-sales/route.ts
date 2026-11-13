import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SaleInput = { title?: unknown; productId?: unknown; discountType?: unknown; discountValue?: unknown; startAt?: unknown; endAt?: unknown; active?: unknown };

/** Valida e normaliza os campos de uma promoção (criação ou edição completa). */
async function parseSale(b: SaleInput) {
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 120) : "";
  const productId = typeof b.productId === "string" ? b.productId : "";
  const discountType = b.discountType === "FIXED" ? "FIXED" : "PERCENT";
  const discountValue = Number(String(b.discountValue ?? "").replace(",", "."));
  const startAt = new Date(String(b.startAt || ""));
  const endAt = new Date(String(b.endAt || ""));
  if (!title) return { error: "Dê um nome para a promoção" };
  if (!productId) return { error: "Escolha o produto" };
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { price: true } });
  if (!product) return { error: "Produto não encontrado" };
  if (!Number.isFinite(discountValue) || discountValue <= 0) return { error: "Informe o desconto" };
  if (discountType === "PERCENT" && discountValue >= 100) return { error: "O desconto precisa ser menor que 100%" };
  if (discountType === "FIXED" && discountValue >= product.price) return { error: "O desconto precisa ser menor que o preço do produto" };
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return { error: "Informe início e fim" };
  if (endAt <= startAt) return { error: "O fim precisa ser depois do início" };
  return { data: { title, productId, discountType, discountValue, startAt, endAt, active: b.active !== false } };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const flashSales = await prisma.flashSale.findMany({
      include: { product: { select: { id: true, name: true, slug: true, price: true, images: true } } },
      orderBy: { startAt: "desc" },
    });
    return NextResponse.json(flashSales);
  } catch (error) {
    console.error("Get flash sales error:", error);
    return NextResponse.json({ error: "Failed to fetch flash sales" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = await parseSale(await req.json());
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const flashSale = await prisma.flashSale.create({
      data: parsed.data,
      include: { product: { select: { id: true, name: true, slug: true, price: true } } },
    });

    return NextResponse.json(flashSale, { status: 201 });
  } catch (error) {
    console.error("Create flash sale error:", error);
    return NextResponse.json({ error: "Failed to create flash sale" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, ...body } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Só ligar/desligar, ou edição completa validada
    const onlyToggle = Object.keys(body).length === 1 && typeof body.active === "boolean";
    let data: Record<string, unknown>;
    if (onlyToggle) {
      data = { active: body.active };
    } else {
      const parsed = await parseSale(body);
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      data = parsed.data;
    }

    const updated = await prisma.flashSale.update({
      where: { id },
      data,
      include: { product: { select: { id: true, name: true, slug: true, price: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update flash sale error:", error);
    return NextResponse.json({ error: "Failed to update flash sale" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await prisma.flashSale.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete flash sale error:", error);
    return NextResponse.json({ error: "Failed to delete flash sale" }, { status: 500 });
  }
}
