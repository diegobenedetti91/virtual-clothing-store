import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
