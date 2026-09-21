import { Suspense } from "react";
import OrderTracking from "@/components/customer/OrderTracking";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RastreamentoPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Rastreamento do Pedido</h1>
          <p className="text-gray-600 mt-2">
            Acompanhe seu pedido em tempo real
          </p>
        </div>

        {/* Tracking Component */}
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
              <div className="h-20 bg-gray-200 rounded-lg animate-pulse"></div>
            </div>
          }
        >
          <OrderTracking orderId={id} />
        </Suspense>

        {/* Help Section */}
        <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Dúvidas Frequentes</h2>

          <div className="space-y-4">
            <div>
              <p className="font-semibold text-gray-900">📦 O que significa cada status?</p>
              <ul className="text-sm text-gray-700 mt-2 space-y-1 ml-4">
                <li><strong>Aguardando Coleta:</strong> Etiqueta criada, aguardando transportadora coletar</li>
                <li><strong>Em Trânsito:</strong> Transportadora já coletou e está entregando</li>
                <li><strong>Entregue:</strong> Seu pacote foi entregue com sucesso</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-gray-900">⏱️ Com que frequência é atualizado?</p>
              <p className="text-sm text-gray-700 mt-2">
                O rastreamento é sincronizado automaticamente a cada 6 horas com o Melhor Envio.
                Clique em "Atualizar Rastreamento" para forçar uma sincronização.
              </p>
            </div>

            <div>
              <p className="font-semibold text-gray-900">🔗 Posso rastrear nos Correios?</p>
              <p className="text-sm text-gray-700 mt-2">
                Sim! Você pode clicar em "Rastrear nos Correios" para ver mais detalhes no site oficial dos Correios.
              </p>
            </div>

            <div>
              <p className="font-semibold text-gray-900">❓ Preciso de ajuda?</p>
              <p className="text-sm text-gray-700 mt-2">
                Se tiver dúvidas ou problemas, entre em contato com nosso atendimento ao cliente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
