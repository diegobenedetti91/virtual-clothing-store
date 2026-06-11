import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const where: any = {};

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

    // Calculate summary
    const summary = {
      totalRevenue: 0,
      totalFees: 0,
      netRevenue: 0,
      orderCount: orders.length,
      byMethod: {} as Record<string, { count: number; revenue: number; fees: number }>,
    };

    orders.forEach((order) => {
      summary.totalRevenue += order.total;
      summary.totalFees += order.paymentFee || 0;

      const method = order.paymentMethod || order.paymentGateway || "Outros";
      if (!summary.byMethod[method]) {
        summary.byMethod[method] = { count: 0, revenue: 0, fees: 0 };
      }
      summary.byMethod[method].count++;
      summary.byMethod[method].revenue += order.total;
      summary.byMethod[method].fees += order.paymentFee || 0;
    });

    summary.netRevenue = summary.totalRevenue - summary.totalFees;

    return NextResponse.json({
      orders,
      summary,
    });
  } catch (error) {
    console.error("[RELATORIOS] Error:", error);
    return NextResponse.json({ error: "Erro ao carregar relatório" }, { status: 500 });
  }
}
