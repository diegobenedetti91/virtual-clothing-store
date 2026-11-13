import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowRight, ShoppingCart } from "lucide-react";
import { formatCurrency, formatDate, ORDER_STATUS } from "@/lib/utils";
import { getCompanySettings } from "@/lib/company";
import DashboardBI from "@/components/admin/DashboardBI";

export default async function AdminDashboard() {
  const [recentOrders, settings] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, orderNumber: true, customerName: true, createdAt: true, total: true, status: true },
    }),
    getCompanySettings(),
  ]);

  return (
    <div className="space-y-6">
      <DashboardBI storeName={settings?.name} />

      <section className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
        <header className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">Pedidos recentes</h3>
            <p className="text-xs text-gray-500 mt-0.5">Os últimos pedidos que chegaram</p>
          </div>
          <Link href="/admin/pedidos" className="text-xs font-medium text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
            Ver todos <ArrowRight size={12} />
          </Link>
        </header>

        {recentOrders.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <ShoppingCart size={36} className="mx-auto mb-2 opacity-40" />
            <p>Nenhum pedido ainda</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="py-2 px-2 font-medium">Pedido</th>
                  <th className="py-2 px-2 font-medium">Cliente</th>
                  <th className="py-2 px-2 font-medium">Data</th>
                  <th className="py-2 px-2 font-medium text-right">Total</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => {
                  const status = ORDER_STATUS[order.status] || ORDER_STATUS.PENDING;
                  return (
                    <tr key={order.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-2">
                        <Link href={`/admin/pedidos/${order.id}`} className="font-medium text-gray-900 hover:text-brand">
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-gray-700">{order.customerName}</td>
                      <td className="py-2.5 px-2 text-gray-500 tabular-nums">{formatDate(order.createdAt)}</td>
                      <td className="py-2.5 px-2 font-semibold text-gray-900 text-right tabular-nums">{formatCurrency(order.total)}</td>
                      <td className="py-2.5 px-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${status.color}`}>{status.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
