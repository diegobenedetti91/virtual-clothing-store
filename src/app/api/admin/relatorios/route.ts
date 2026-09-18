import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function calculateTotalRefunded(orderId: string): Promise<number> {
  const approvedReturns = await prisma.return.findMany({
    where: { orderId, status: "APPROVED" },
  });

  return approvedReturns.reduce((sum, ret) => sum + ret.refundAmount, 0);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const where: any = {
      status: { in: ["DELIVERED", "RETIRADO"] },
    };

    if (dateFrom) {
      where.createdAt = { gte: new Date(dateFrom) };
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (where.createdAt) {
        where.createdAt.lte = toDate;
      } else {
        where.createdAt = { lte: toDate };
      }
    }

    const orders = await prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        total: true,
        paymentFee: true,
        paymentMethod: true,
        paymentGateway: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Calcular devoluções para cada pedido
    const ordersWithRefunds = await Promise.all(
      orders.map(async (order) => {
        const totalRefunded = await calculateTotalRefunded(order.id);
        return {
          ...order,
          totalRefunded,
          liquidTotal: order.total - totalRefunded,
        };
      })
    );

    // Calculate summary
    const summary = {
      totalRevenue: 0,
      totalRefunds: 0,
      liquidRevenue: 0,
      totalFees: 0,
      netRevenue: 0,
      orderCount: ordersWithRefunds.length,
      byMethod: {} as Record<string, { count: number; revenue: number; refunds: number; liquidRevenue: number; fees: number }>,
    };

    ordersWithRefunds.forEach((order) => {
      summary.totalRevenue += order.total;
      summary.totalRefunds += order.totalRefunded;
      summary.liquidRevenue += order.liquidTotal;
      summary.totalFees += order.paymentFee || 0;

      const method = order.paymentMethod || order.paymentGateway || "Outros";
      if (!summary.byMethod[method]) {
        summary.byMethod[method] = { count: 0, revenue: 0, refunds: 0, liquidRevenue: 0, fees: 0 };
      }
      summary.byMethod[method].count++;
      summary.byMethod[method].revenue += order.total;
      summary.byMethod[method].refunds += order.totalRefunded;
      summary.byMethod[method].liquidRevenue += order.liquidTotal;
      summary.byMethod[method].fees += order.paymentFee || 0;
    });

    summary.netRevenue = summary.liquidRevenue - summary.totalFees;

    return NextResponse.json({
      orders: ordersWithRefunds.map(({ id, ...order }) => order),
      summary,
    });
  } catch (error) {
    console.error("[RELATORIOS] Error:", error);
    return NextResponse.json({ error: "Erro ao carregar relatório" }, { status: 500 });
  }
}
