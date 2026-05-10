import AvaliacoesManager from "@/components/admin/AvaliacoesManager";

export default function AvaliacoesPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Avaliações</h1>
        <p className="text-gray-500 text-sm mt-1">Modere as avaliações dos clientes antes de publicá-las nos produtos.</p>
      </div>
      <AvaliacoesManager />
    </div>
  );
}
