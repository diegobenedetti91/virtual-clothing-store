import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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
    const { title, productId, discountType, discountValue, startAt, endAt } = await req.json();

    if (!title || !productId || !discountType || !discountValue || !startAt || !endAt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const flashSale = await prisma.flashSale.create({
      data: {
        title,
        productId,
        discountType,
        discountValue: parseFloat(discountValue),
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        active: true,
      },
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
    const { id, ...data } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const updated = await prisma.flashSale.update({
      where: { id },
      data: {
        ...data,
        ...(data.discountValue && { discountValue: parseFloat(data.discountValue) }),
        ...(data.startAt && { startAt: new Date(data.startAt) }),
        ...(data.endAt && { endAt: new Date(data.endAt) }),
      },
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
