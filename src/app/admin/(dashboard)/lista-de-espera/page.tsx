import WaitlistManager from "@/components/admin/WaitlistManager";

export default function ListaDeEsperaPage() {
  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Lista de espera</h1>
        <p className="text-gray-500 text-sm mt-1">
          Clientes que querem ser avisados quando uma variação de produto voltar ao estoque.
        </p>
      </div>
      <WaitlistManager />
    </div>
  );
}
