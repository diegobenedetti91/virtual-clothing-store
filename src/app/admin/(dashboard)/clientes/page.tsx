import ClientesManager from "@/components/admin/ClientesManager";

export default function ClientesPage() {
  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <p className="text-gray-500 text-sm mt-1">Clientes cadastrados, histórico de compras e valor total gasto.</p>
      </div>
      <ClientesManager />
    </div>
  );
}
