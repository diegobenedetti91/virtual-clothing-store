"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TrendingUp, Download, Filter } from "lucide-react";

interface PaymentReport {
  orderNumber: string;
  customerName: string;
  total: number;
  paymentFee: number;
  paymentMethod: string;
  paymentGateway: string;
  createdAt: string;
  status: string;
}

interface Summary {
  totalRevenue: number;
  totalFees: number;
  netRevenue: number;
  orderCount: number;
  byMethod: Record<string, { count: number; revenue: number; fees: number }>;
}

export default function RelatoriosPage() {
  const [orders, setOrders] = useState<PaymentReport[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("todos");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);

      const res = await fetch(`/api/admin/relatorios?${params.toString()}`);
      const data = await res.json();
      setOrders(data.orders);
      setSummary(data.summary);
    } catch (err) {
      console.error("Erro ao carregar relatório:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    fetchData();
  };

  const exportCSV = () => {
    const headers = ["Pedido", "Cliente", "Valor", "Taxa", "Líquido", "Método", "Data"];
    const rows = filteredOrders.map((order) => [
      order.orderNumber,
      order.customerName,
      order.total,
      order.paymentFee,
      order.total - order.paymentFee,
      order.paymentMethod || order.paymentGateway,
      new Date(order.createdAt).toLocaleDateString("pt-BR"),
    ]);

    let csv = headers.join(",") + "\n";
    rows.forEach((row) => {
      csv += row.map((cell) => `"${cell}"`).join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-pagamentos-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const filteredOrders =
    selectedMethod === "todos"
      ? orders
      : orders.filter((o) => (o.paymentMethod || o.paymentGateway) === selectedMethod);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Relatório de Pagamentos</h1>
        <p className="text-gray-500 mt-1">Acompanhe receita, taxas e métodos de pagamento</p>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-6 border border-gray-100">
            <p className="text-xs text-gray-500 font-semibold">RECEITA BRUTA</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(summary.totalRevenue)}</p>
            <p className="text-xs text-gray-500 mt-2">{summary.orderCount} pedidos</p>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-100">
            <p className="text-xs text-gray-500 font-semibold">TAXAS</p>
            <p className="text-2xl font-bold text-red-600 mt-2">-{formatCurrency(summary.totalFees)}</p>
            <p className="text-xs text-gray-500 mt-2">
              {summary.totalRevenue > 0 ? ((summary.totalFees / summary.totalRevenue) * 100).toFixed(1) : 0}% do total
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-100">
            <p className="text-xs text-gray-500 font-semibold">RECEITA LÍQUIDA</p>
            <p className="text-2xl font-bold text-green-600 mt-2">{formatCurrency(summary.netRevenue)}</p>
            <TrendingUp className="w-4 h-4 text-green-600 mt-2" />
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-100">
            <p className="text-xs text-gray-500 font-semibold">TICKET MÉDIO</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {formatCurrency(summary.totalRevenue / Math.max(summary.orderCount, 1))}
            </p>
            <p className="text-xs text-gray-500 mt-2">por pedido</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg p-4 border border-gray-100 flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-xs font-semibold text-gray-600">DE</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">ATÉ</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">MÉTODO</label>
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="todos">Todos</option>
            <option value="mercadopago">Mercado Pago</option>
            <option value="nupay">NuPay</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="WhatsApp">WhatsApp</option>
          </select>
        </div>
        <button
          onClick={handleFilter}
          className="px-4 py-2 bg-brand text-white rounded-lg font-semibold hover:opacity-90 flex items-center gap-2"
        >
          <Filter size={16} />
          Filtrar
        </button>
        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg font-semibold hover:bg-gray-300 flex items-center gap-2 ml-auto"
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">PEDIDO</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">CLIENTE</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">MÉTODO</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">VALOR</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">TAXA</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">LÍQUIDO</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">DATA</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map((order) => (
                <tr key={order.orderNumber} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-gray-900">{order.orderNumber}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{order.customerName}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {order.paymentMethod || order.paymentGateway || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                    {formatCurrency(order.total)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-red-600">
                    -{formatCurrency(order.paymentFee)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-green-600">
                    {formatCurrency(order.total - order.paymentFee)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(order.createdAt)}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        order.status === "CONFIRMED"
                          ? "bg-green-100 text-green-800"
                          : order.status === "CANCELLED"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
