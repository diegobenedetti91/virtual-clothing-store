import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { computeReturnRefund } from "@/lib/returnRefund";

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

    // Devoluções em aberto: valor recalculado com a regra atual (rateio de cupom/Pix/crédito),
    // o mesmo que será estornado na aprovação
    const withPreview = await Promise.all(
      returns.map(async (r) => {
        if (r.status !== "PENDING" && r.status !== "AWAITING_RETURN") return r;
        const split = await computeReturnRefund(r.orderId, r.returnedItems, r.id).catch(() => null);
        return split ? { ...r, refundAmount: split.money, refundCredit: split.credit } : r;
      })
    );

    return NextResponse.json(withPreview);
  } catch (error) {
    console.error("[admin/returns] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar devoluções" }, { status: 500 });
  }
}
