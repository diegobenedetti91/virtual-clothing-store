import { prisma } from "@/lib/prisma";
import SettingsForm from "@/components/admin/SettingsForm";
import { CompanySettings } from "@/types";

export default async function AdminSettingsPage() {
  const settings = (await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } })) as unknown as CompanySettings | null;
  return <SettingsForm initialSettings={settings} />;
}
