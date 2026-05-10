import Link from "next/link";
import { XCircle } from "lucide-react";

interface Props { searchParams: Promise<{ order?: string }> }

export default async function CheckoutFalhaPage({ searchParams }: Props) {
  const { order } = await searchParams;
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle size={32} className="text-red-600" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">Pagamento recusado</h1>
        {order && <p className="text-sm text-gray-500 mb-1">Pedido: <span className="font-bold text-gray-800">{order}</span></p>}
        <p className="text-gray-500 text-sm mb-8">
          Houve um problema com o pagamento. Verifique os dados do cartão ou tente outra forma de pagamento.
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/carrinho" className="w-full py-3 bg-pink-600 text-white rounded-xl font-bold hover:bg-pink-700 transition-colors text-sm">
            Tentar novamente
          </Link>
          <Link href="/produtos" className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm">
            Voltar à loja
          </Link>
        </div>
      </div>
    </div>
  );
}
