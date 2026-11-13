import { prisma } from "@/lib/prisma";
import VariationsManager from "@/components/admin/VariationsManager";

export default async function VariacoesPage() {
  const templates = await prisma.variationTemplate.findMany({
    orderBy: { name: "asc" },
  });

  return <VariationsManager initialTemplates={templates} />;
}
