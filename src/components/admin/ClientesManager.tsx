"use client";

import { useEffect, useState } from "react";
import { Users, ShoppingCart, Heart, TrendingUp, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface CustomerRow {
  id: string; name: string; email: string; phone?: string | null;
  city?: string | null; state?: string | null;
  orderCount: number; wishlistCount: number; totalSpent: number;
  createdAt: string; lastOrderAt: string | null;
}

export default function ClientesManager() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/customers").then((r) => r.json()).then((d) => { setCustomers(d); setLoading(false); });
  }, []);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.phone || "").includes(q);
  });

  const totalSpent = customers.reduce((s, c) => s + c.totalSpent, 0);
  const withOrders = customers.filter((c) => c.orderCount > 0).length;

  if (loading) return <div className="py-20 flex justify-center"><div className="w-6 h-6 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Clientes cadastrados", value: customers.length, icon: Users, color: "bg-blue-100 text-blue-600" },
          { label: "Já compraram", value: withOrders, icon: ShoppingCart, color: "bg-green-100 text-green-600" },
          { label: "Receita total clientes", value: formatCurrency(totalSpent), icon: TrendingUp, color: "bg-pink-100 text-pink-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className={`inline-flex p-2.5 rounded-xl ${color} mb-3`}><Icon size={18} /></div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Search + table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            {customers.length === 0 ? "Nenhum cliente cadastrado ainda." : "Nenhum resultado encontrado."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-500">Cliente</th>
                  <th className="px-4 py-3 font-semibold text-gray-500">Cidade/UF</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 text-center">Pedidos</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 text-center"><Heart size={13} className="inline" /></th>
                  <th className="px-4 py-3 font-semibold text-gray-500 text-right">Total gasto</th>
                  <th className="px-4 py-3 font-semibold text-gray-500">Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.email}</p>
                      {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {c.city && c.state ? `${c.city}/${c.state}` : c.city || c.state || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${c.orderCount > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                        {c.orderCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 text-xs">{c.wishlistCount}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {c.totalSpent > 0 ? formatCurrency(c.totalSpent) : <span className="text-gray-300 font-normal">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
