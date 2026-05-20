import EmbalagensManager from "@/components/admin/EmbalagensManager";

export default function EmbalagensPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Embalagens</h1>
        <p className="text-gray-500 text-sm mt-1">
          Cadastre os tipos de caixa disponíveis para empacotamento dos pedidos.
        </p>
      </div>
      <EmbalagensManager />
    </div>
  );
}
