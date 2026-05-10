import { prisma } from "@/lib/prisma";
import OrdersManager from "@/components/admin/OrdersManager";
import { Order } from "@/types";

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true } }, customer: true },
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
}
