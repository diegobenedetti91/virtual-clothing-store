import { prisma } from "@/lib/prisma";
import SettingsForm from "@/components/admin/SettingsForm";
import { CompanySettings } from "@/types";

export default async function AdminSettingsPage() {
  let settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "asc" } }) as unknown as CompanySettings | null;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configurações da loja</h1>
        <p className="text-gray-500 text-sm mt-1">Personalize as informações e aparência da sua loja</p>
      </div>
      <SettingsForm initialSettings={settings} />
    </div>
  );
}
