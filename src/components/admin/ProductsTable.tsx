"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Pencil, Trash2, Eye, EyeOff, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import DeleteProductButton from "./DeleteProductButton";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  active: boolean;
  featured: boolean;
  images: string;
  category: {
    name: string;
  };
  createdAt: Date;
}

interface ProductsTableProps {
  products: Product[];
}

function calculateSimilarity(text: string, query: string): number {
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();

  if (normalizedText.includes(normalizedQuery)) {
    return 1;
  }

  let matches = 0;
  for (let i = 0; i < normalizedQuery.length; i++) {
    if (normalizedText.includes(normalizedQuery[i])) {
      matches++;
    }
  }

  return matches / normalizedQuery.length;
}

export default function ProductsTable({ products }: ProductsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      return products;
    }

    return products
      .map((product) => {
        const descriptionForSearch = product.description || product.name;
        const similarity = calculateSimilarity(descriptionForSearch, searchQuery);
        return { product, similarity };
      })
      .filter(({ similarity }) => similarity > 0.4)
      .sort(({ similarity: a }, { similarity: b }) => b - a)
      .map(({ product }) => product);
  }, [products, searchQuery]);

  return (
    <div>
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por descrição..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
        </div>
        {searchQuery && (
          <p className="text-sm text-gray-500 mt-2">
            {filteredProducts.length} de {products.length} produto{products.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <p className="text-gray-400">Nenhum produto encontrado para "{searchQuery}".</p>
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
                {filteredProducts.map((product) => {
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
                          <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                            <Eye size={12} /> Ativo
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-400 text-xs font-medium">
                            <EyeOff size={12} /> Inativo
                          </span>
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
