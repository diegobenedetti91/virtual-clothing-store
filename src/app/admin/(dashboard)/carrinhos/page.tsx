import CarrinhosManager from "@/components/admin/CarrinhosManager";

export default function CarrinhosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Carrinhos abandonados</h1>
        <p className="text-sm text-gray-500 mt-1">Clientes que deixaram peças no carrinho sem finalizar. Lembre por e-mail ou WhatsApp e acompanhe quem voltou para comprar.</p>
      </div>
      <CarrinhosManager />
    </div>
  );
}
