import CarrinhosManager from "@/components/admin/CarrinhosManager";

export default function CarrinhosPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Carrinhos abandonados</h1>
        <p className="text-gray-500 text-sm mt-1">Clientes que adicionaram produtos mas não finalizaram a compra. Envie um lembrete por e-mail.</p>
      </div>
      <CarrinhosManager />
    </div>
  );
}
