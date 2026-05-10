import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromRequest } from "@/lib/customerAuth";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const reviews = await prisma.productReview.findMany({
    where: { productId: id, approved: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(reviews);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const customer = getCustomerFromRequest(req);
  const { rating, comment, authorName } = await req.json();

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Nota inválida" }, { status: 400 });
  }

  const name = customer?.name || authorName?.trim();
  if (!name) return NextResponse.json({ error: "Informe seu nome" }, { status: 400 });

  // One review per customer per product
  if (customer) {
    const existing = await prisma.productReview.findFirst({
      where: { productId: id, customerId: customer.id },
    });
    if (existing) return NextResponse.json({ error: "Você já avaliou este produto" }, { status: 409 });
  }

  const review = await prisma.productReview.create({
    data: {
      productId: id,
      customerId: customer?.id || null,
      authorName: name,
      rating,
      comment: comment?.trim() || null,
      approved: false,
    },
  });

  return NextResponse.json(review, { status: 201 });
}
