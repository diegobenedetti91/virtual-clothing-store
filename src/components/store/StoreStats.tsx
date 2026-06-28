import { prisma } from "@/lib/prisma";
import { Truck, ShoppingBag } from "lucide-react";

export async function StoreStats() {
  const [deliveredOrders, totalItemsSold] = await Promise.all([
    prisma.order.count({
      where: {
        status: {
          in: ["DELIVERED", "RETIRADO"],
        },
      },
    }),
    prisma.orderItem.aggregate({
      _sum: { quantity: true },
      where: {
        order: {
          status: {
            in: ["DELIVERED", "RETIRADO"],
          },
        },
      },
    }),
  ]);

  const itemsCount = totalItemsSold._sum?.quantity || 0;

  return (
    <div className="flex items-center gap-3 sm:gap-5">
      {/* Delivered Orders */}
      <div className="flex items-center gap-2.5 px-3.5 py-3 sm:px-5 sm:py-3.5 bg-white/10 hover:bg-white/15 rounded-xl border border-white/20 hover:border-white/40 transition-all backdrop-blur-sm">
        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-brand to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
          <Truck size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm sm:text-base font-bold text-white">
            {deliveredOrders.toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-white/70 font-medium truncate">Entregue{deliveredOrders !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Items Sold */}
      <div className="flex items-center gap-2.5 px-3.5 py-3 sm:px-5 sm:py-3.5 bg-white/10 hover:bg-white/15 rounded-xl border border-white/20 hover:border-white/40 transition-all backdrop-blur-sm">
        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-400 to-brand rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
          <ShoppingBag size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm sm:text-base font-bold text-white">
            {itemsCount.toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-white/70 font-medium truncate">Vendido{itemsCount !== 1 ? "s" : ""}</p>
        </div>
      </div>
    </div>
  );
}
