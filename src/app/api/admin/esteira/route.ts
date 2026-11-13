import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Pedidos da esteira: tudo que ainda está em andamento, mais o que foi concluído
 * recentemente (para conferência). Aguardando pagamento antigos não poluem a tela.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const now = Date.now();
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { status: { in: ["CONFIRMED", "SHIPPED", "PRONTO_PARA_RETIRADA"] } },
        { status: "PENDING", createdAt: { gte: new Date(now - 7 * DAY) } },
        { status: { in: ["DELIVERED", "RETIRADO"] }, updatedAt: { gte: new Date(now - 15 * DAY) } },
      ],
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      total: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      paymentMethod: true,
      shippingMethod: true,
      city: true,
      state: true,
      trackingCode: true,
      melhorEnvioShipmentId: true,
      labelValid: true,
      shipmentRetryError: true,
      blingPedidoId: true,
      couponCode: true,
      items: { select: { quantity: true, product: { select: { name: true, images: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 400,
  });

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { blingAtivo: true } });

  return NextResponse.json({
    blingEnabled: !!settings?.blingAtivo,
    orders: orders.map(({ items, ...o }) => ({
      ...o,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      thumbs: items.slice(0, 3).map((i) => {
        try {
          const imgs = JSON.parse(i.product.images || "[]");
          return { name: i.product.name, image: Array.isArray(imgs) ? imgs[0] ?? null : null };
        } catch {
          return { name: i.product.name, image: null };
        }
      }),
    })),
  });
}
