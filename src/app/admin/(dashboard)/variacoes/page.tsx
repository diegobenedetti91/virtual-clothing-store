import { prisma } from "@/lib/prisma";
import VariationsManager from "@/components/admin/VariationsManager";

export default async function VariacoesPage() {
  const templates = await prisma.variationTemplate.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Variações</h1>
        <p className="text-gray-500 text-sm mt-1">
          Cadastre tipos de variação reutilizáveis — ao criar um produto, basta selecionar e aplicar.
        </p>
      </div>
      <VariationsManager initialTemplates={templates} />
    </div>
  );
}
