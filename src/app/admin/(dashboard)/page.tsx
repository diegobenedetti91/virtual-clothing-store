import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Package, ShoppingCart, Tag, TrendingUp, Plus, ExternalLink } from "lucide-react";
import { formatCurrency, formatDate, ORDER_STATUS } from "@/lib/utils";

export default async function AdminDashboard() {
  const [productCount, categoryCount, orders, recentOrders] = await Promise.all([
    await prisma.product.count({ where: { active: true } }),
    await prisma.category.count({ where: { active: true } }),
    await prisma.order.findMany({ orderBy: { createdAt: "desc" } }),
    await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { items: true },
    }),
  ]);

  const totalRevenue = orders.filter((o) => o.status !== "CANCELLED").reduce((s, o) => s + o.total, 0);
  const pendingOrders = orders.filter((o) => o.status === "PENDING").length;

  const stats = [
    { label: "Produtos ativos", value: productCount, icon: Package, color: "bg-blue-100 text-blue-600", href: "/admin/produtos" },
    { label: "Categorias", value: categoryCount, icon: Tag, color: "bg-purple-100 text-purple-600", href: "/admin/categorias" },
    { label: "Pedidos aguardando", value: pendingOrders, icon: ShoppingCart, color: "bg-yellow-100 text-yellow-600", href: "/admin/pedidos" },
    { label: "Receita total", value: formatCurrency(totalRevenue), icon: TrendingUp, color: "bg-green-100 text-green-600", href: "/admin/pedidos" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Bem-vinda ao painel da sua loja</p>
        </div>
        <div className="flex gap-3">
          <Link href="/" target="_blank" className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:border-gray-300 transition-colors">
            <ExternalLink size={14} /> Ver loja
          </Link>
          <Link href="/admin/produtos/novo" className="flex items-center gap-2 text-sm bg-pink-600 text-white px-4 py-2 rounded-xl hover:bg-pink-700 transition-colors">
            <Plus size={14} /> Novo produto
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className={`inline-flex p-2.5 rounded-xl ${color} mb-3`}>
              <Icon size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Pedidos recentes</h2>
          <Link href="/admin/pedidos" className="text-sm text-pink-600 hover:underline">Ver todos</Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <ShoppingCart size={36} className="mx-auto mb-2 opacity-40" />
            <p>Nenhum pedido ainda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-2 font-semibold text-gray-500">Pedido</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-500">Cliente</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-500">Data</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-500">Total</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => {
                  const status = ORDER_STATUS[order.status] || ORDER_STATUS.PENDING;
                  return (
                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-2">
                        <Link href="/admin/pedidos" className="font-medium text-pink-600 hover:underline">{order.orderNumber}</Link>
                      </td>
                      <td className="py-3 px-2 text-gray-700">{order.customerName}</td>
                      <td className="py-3 px-2 text-gray-500">{formatDate(order.createdAt)}</td>
                      <td className="py-3 px-2 font-semibold text-gray-900">{formatCurrency(order.total)}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${status.color}`}>{status.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
