import { prisma } from "@/lib/prisma";
import OrdersManager from "@/components/admin/OrdersManager";
import { Order, CompanySettings } from "@/types";

export default async function AdminOrdersPage() {
  try {
    const [orders, settings] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          // Só o que a lista mostra (foto e e-mail) — pedidos antigos com muitos itens ficam leves
          items: { include: { product: { select: { id: true, name: true, slug: true, images: true } } } },
          customer: { select: { id: true, email: true, name: true } },
        },
      }),
      prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } }),
    ]);

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Pedidos</h1>
          <p className="text-gray-500 text-sm mt-1">Clique em um pedido para ver detalhes, etiqueta e Bling. Use o botão de cada linha para avançar o status.</p>
        </div>
        <OrdersManager
          initialOrders={orders as unknown as Order[]}
          blingEnabled={settings?.blingAtivo ?? false}
        />
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
