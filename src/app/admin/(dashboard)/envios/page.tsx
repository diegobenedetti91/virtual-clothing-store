import EnviosManager from "@/components/admin/EnviosManager";

export default function EnviosPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Envios pendentes</h1>
        <p className="text-gray-500 text-sm mt-1">
          Pedidos confirmados aguardando envio, com sugestão de embalagem e peso total.
        </p>
      </div>
      <EnviosManager />
    </div>
  );
}
