import { prisma } from "@/lib/prisma";
import { Truck } from "lucide-react";

/** Abaixo disso o número mais atrapalha que ajuda como prova social. */
const MIN_TO_SHOW = 10;

export async function StoreStats() {
  const [deliveredOrders, totalItemsSold] = await Promise.all([
    prisma.order.count({ where: { status: { in: ["DELIVERED", "RETIRADO"] } } }),
    prisma.orderItem.aggregate({
      _sum: { quantity: true },
      where: { order: { status: { in: ["DELIVERED", "RETIRADO"] } } },
    }),
  ]).catch(() => [0, { _sum: { quantity: 0 } }] as const);

  if (deliveredOrders < MIN_TO_SHOW) return null;
  const items = totalItemsSold._sum?.quantity || 0;

  return (
    <div className="inline-flex items-center gap-3 rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3">
      <span className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white shrink-0"><Truck size={17} /></span>
      <p className="text-sm leading-tight">
        <b className="text-white">+{deliveredOrders.toLocaleString("pt-BR")} pedidos entregues</b>
        <span className="block text-xs text-gray-500">{items.toLocaleString("pt-BR")} peças já foram para clientes felizes</span>
      </p>
    </div>
  );
}
