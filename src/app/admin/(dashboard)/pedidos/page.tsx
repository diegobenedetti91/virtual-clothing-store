import { prisma } from "@/lib/prisma";
import OrdersManager from "@/components/admin/OrdersManager";
import { Order } from "@/types";

export default async function AdminOrdersPage() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: { include: { product: true } },
        customer: true,
      },
    }) as unknown as Order[];

    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie todos os pedidos da loja</p>
        </div>
        <OrdersManager initialOrders={orders} />
      </div>
    );
  } catch (error) {
    console.error("[AdminOrdersPage] Error fetching orders:", error);
    return (
      <div className="text-center py-20">
        <p className="text-red-600 font-semibold mb-4">Erro ao carregar pedidos</p>
        <p className="text-gray-600 text-sm">{String(error)}</p>
      </div>
    );
  }
}
