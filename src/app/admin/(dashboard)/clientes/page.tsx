import { prisma } from "@/lib/prisma";
import BlingClientSyncButton from "@/components/admin/BlingClientSyncButton";
import ClientesManager from "@/components/admin/ClientesManager";

export default async function ClientesPage() {
  const settings = await prisma.companySettings.findFirst();

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">Clientes cadastrados, histórico de compras e valor total gasto.</p>
        </div>
        {settings?.blingAtivo && <BlingClientSyncButton />}
      </div>
      <ClientesManager />
    </div>
  );
}
