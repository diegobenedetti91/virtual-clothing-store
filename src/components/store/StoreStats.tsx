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
    <div className="flex items-center gap-4 sm:gap-6">
      {/* Delivered Orders */}
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-r from-brand/10 to-brand/5 rounded-lg border border-brand/20 hover:border-brand/40 transition-colors">
        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-brand to-pink-500 rounded-md flex items-center justify-center flex-shrink-0">
          <Truck size={18} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm sm:text-base font-bold bg-gradient-to-r from-brand to-pink-600 bg-clip-text text-transparent">
            {deliveredOrders.toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-gray-500 truncate">Entregue{deliveredOrders !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Items Sold */}
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-r from-purple-50 to-purple-5 rounded-lg border border-purple-200/50 hover:border-purple-300 transition-colors">
        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-purple-500 to-brand rounded-md flex items-center justify-center flex-shrink-0">
          <ShoppingBag size={18} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm sm:text-base font-bold bg-gradient-to-r from-purple-600 to-brand bg-clip-text text-transparent">
            {itemsCount.toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-gray-500 truncate">Vendido{itemsCount !== 1 ? "s" : ""}</p>
        </div>
      </div>
    </div>
  );
}
