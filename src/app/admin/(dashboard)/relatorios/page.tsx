import RelatoriosManager from "@/components/admin/RelatoriosManager";

export default function RelatoriosPage() {
  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-gray-500 text-sm mt-1">
          Acompanhe o faturamento, desempenho por estado e por categoria para tomar decisões estratégicas.
        </p>
      </div>
      <RelatoriosManager />
    </div>
  );
}
