import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();

    const flashSales = await prisma.flashSale.findMany({
      where: {
        active: true,
        startAt: { lte: now },
        endAt: { gte: now },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            comparePrice: true,
            images: true,
          },
        },
      },
    });

    const withDiscount = flashSales.filter((sale) => sale.product !== null).map((sale) => {
      const productPrice = sale.product!.price;
      let finalPrice = productPrice;
      let discountPercent = 0;

      if (sale.discountType === "PERCENT") {
        discountPercent = sale.discountValue;
        finalPrice = productPrice * (1 - sale.discountValue / 100);
      } else if (sale.discountType === "FIXED") {
        finalPrice = productPrice - sale.discountValue;
        discountPercent = ((sale.discountValue / productPrice) * 100);
      }

      return {
        ...sale,
        finalPrice: Math.max(0, finalPrice),
        discountPercent: Math.round(discountPercent),
      };
    });

    return NextResponse.json(withDiscount);
  } catch (error) {
    console.error("Get active flash sales error:", error);
    return NextResponse.json({ error: "Failed to fetch flash sales" }, { status: 500 });
  }
}
