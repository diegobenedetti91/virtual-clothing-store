import { prisma } from "@/lib/prisma";
import { Package, Truck, ShoppingBag } from "lucide-react";

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

  const stats = [
    {
      icon: Truck,
      value: deliveredOrders,
      label: deliveredOrders === 1 ? "Pedido Entregue" : "Pedidos Entregues",
    },
    {
      icon: ShoppingBag,
      value: itemsCount,
      label: itemsCount === 1 ? "Item Vendido" : "Itens Vendidos",
    },
  ];

  return (
    <section className="bg-brand/5 border-y border-brand/10 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-2 gap-6">
          {stats.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mb-3 group hover:bg-brand/20 transition-colors">
                <Icon size={24} className="text-brand" />
              </div>
              <p className="text-2xl md:text-3xl font-bold text-gray-900">
                {value.toLocaleString("pt-BR")}
              </p>
              <p className="text-sm text-gray-600 mt-1">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 text-center mt-6">
          ✓ Compre com confiança | Milhares de clientes satisfeitos
        </p>
      </div>
    </section>
  );
}
