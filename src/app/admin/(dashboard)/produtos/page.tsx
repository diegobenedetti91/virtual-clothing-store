import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import DeleteProductButton from "@/components/admin/DeleteProductButton";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
          <p className="text-gray-500 text-sm mt-1">{products.length} produto{products.length !== 1 ? "s" : ""} cadastrado{products.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/admin/produtos/novo" className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-pink-700 transition-colors">
          <Plus size={16} /> Novo produto
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <p className="text-gray-400 mb-4">Nenhum produto cadastrado ainda.</p>
          <Link href="/admin/produtos/novo" className="inline-flex items-center gap-2 bg-pink-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-pink-700 transition-colors">
            <Plus size={16} /> Cadastrar produto
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-500">Produto</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-500 hidden sm:table-cell">Categoria</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-500">Preço</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-500 hidden md:table-cell">Estoque</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-500">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const images = JSON.parse(product.images || "[]") as string[];
                  return (
                    <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                            {images[0] ? (
                              <img src={images[0]} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg">👗</div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 truncate max-w-[150px]">{product.name}</p>
                            {product.featured && <span className="text-xs text-pink-600 font-medium">Destaque</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500 hidden sm:table-cell">{product.category.name}</td>
                      <td className="py-3 px-4 font-semibold text-gray-900">{formatCurrency(product.price)}</td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className={`text-sm ${product.stock === 0 ? "text-red-500" : "text-gray-700"}`}>
                          {product.stock === 0 ? "Sem estoque" : `${product.stock} un.`}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {product.active ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><Eye size={12} /> Ativo</span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-400 text-xs font-medium"><EyeOff size={12} /> Inativo</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/admin/produtos/${product.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                            <Pencil size={15} />
                          </Link>
                          <DeleteProductButton id={product.id} name={product.name} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
