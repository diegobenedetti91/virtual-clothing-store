import RelatoriosManager from "@/components/admin/RelatoriosManager";

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Relatórios</h1>
        <p className="text-gray-500 text-sm mt-1">
          Faturamento, lucro, origem das vendas e cancelamentos — filtre o período e exporte qualquer tabela para o Excel.
        </p>
      </div>
      <RelatoriosManager />
    </div>
  );
}
