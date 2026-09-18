import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get("status");

    const returns = await prisma.return.findMany({
      where: status ? { status } : undefined,
      include: {
        order: {
          include: { items: { include: { product: true } } },
        },
        customer: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(returns);
  } catch (error) {
    console.error("[admin/returns] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar devoluções" }, { status: 500 });
  }
}
