import { prisma } from "@/lib/prisma";
import { Truck, ShoppingBag, Star, Heart } from "lucide-react";

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
    <section className="py-12 bg-gradient-to-r from-brand/10 via-purple-50 to-pink-50 border-y border-brand/10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* Delivered Orders Card */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-brand to-pink-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur" />
            <div className="relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-shadow duration-300 border border-brand/10">
              <div className="flex items-start justify-between mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-brand to-pink-500 rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300">
                  <Truck size={32} className="text-white" />
                </div>
                <Star size={20} className="text-yellow-400 fill-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <p className="text-4xl md:text-5xl font-black bg-gradient-to-r from-brand to-pink-600 bg-clip-text text-transparent">
                {deliveredOrders.toLocaleString("pt-BR")}
              </p>
              <p className="text-gray-600 font-semibold mt-2">
                {deliveredOrders === 1 ? "Pedido Entregue" : "Pedidos Entregues"}
              </p>
              <p className="text-xs text-gray-400 mt-3">com satisfação garantida</p>
            </div>
          </div>

          {/* Items Sold Card */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-brand rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur" />
            <div className="relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-shadow duration-300 border border-purple-200/50">
              <div className="flex items-start justify-between mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-brand rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300">
                  <ShoppingBag size={32} className="text-white" />
                </div>
                <Heart size={20} className="text-red-400 fill-red-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <p className="text-4xl md:text-5xl font-black bg-gradient-to-r from-purple-600 to-brand bg-clip-text text-transparent">
                {itemsCount.toLocaleString("pt-BR")}
              </p>
              <p className="text-gray-600 font-semibold mt-2">
                {itemsCount === 1 ? "Item Vendido" : "Itens Vendidos"}
              </p>
              <p className="text-xs text-gray-400 mt-3">escolhidos com cuidado</p>
            </div>
          </div>
        </div>

        {/* Trust badge */}
        <div className="mt-10 bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-brand/20 text-center">
          <p className="text-sm font-semibold text-gray-700">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Compre com confiança – Milhares de clientes satisfeitos
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
