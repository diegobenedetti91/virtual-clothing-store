import { prisma } from "@/lib/prisma";
import ProductCard from "@/components/store/ProductCard";
import Link from "next/link";
import { Search, LayoutGrid } from "lucide-react";
import type { Product } from "@/types";

interface PageProps {
  searchParams: Promise<{ category?: string; search?: string; menu?: string }>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const { category, search, menu } = await searchParams;

  const [categories, productsRaw, activeNavItem] = await Promise.all([
    await prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    await prisma.product.findMany({
      where: {
        active: true,
        ...(category ? { category: { slug: category } } : {}),
        ...(menu ? { navItems: { some: { id: menu } } } : {}),
        ...(search
          ? { OR: [{ name: { contains: search } }, { description: { contains: search } }] }
          : {}),
      },
      include: { category: true, navItems: { select: { id: true, label: true } } },
      orderBy: { createdAt: "desc" },
    }),
    menu ? await prisma.navItem.findUnique({ where: { id: menu } }) : null,
  ]);
  const products = productsRaw as unknown as Product[];
  const activeCategory = categories.find((c) => c.slug === category);

  return (
    <div className="bg-white min-h-screen">
      {/* Page hero strip */}
      <div className="bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <LayoutGrid size={14} className="text-pink-400" />
                <span className="text-xs font-bold text-pink-500 uppercase tracking-widest">Catálogo</span>
              </div>
              <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                {activeNavItem ? activeNavItem.label : activeCategory ? activeCategory.name : search ? `"${search}"` : "Todos os Produtos"}
              </h1>
              <p className="text-gray-400 text-sm mt-1.5 font-medium">
                {products.length === 0
                  ? "Nenhum produto encontrado"
                  : `${products.length} produto${products.length !== 1 ? "s" : ""}`}
              </p>
            </div>

            <form method="GET" className="sm:ml-auto flex gap-2 w-full sm:w-auto">
              {category && <input type="hidden" name="category" value={category} />}
              <div className="relative flex-1 sm:flex-none">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  name="search"
                  defaultValue={search}
                  placeholder="Buscar produtos..."
                  className="w-full sm:w-64 border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition shadow-sm"
                />
              </div>
              <button
                type="submit"
                className="bg-pink-600 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-pink-700 transition-colors shadow-sm shrink-0"
              >
                Buscar
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category filters */}
        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-10 pb-6 border-b border-gray-100">
            <Link
              href={search ? `/produtos?search=${search}` : "/produtos"}
              className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                !category
                  ? "bg-gray-900 text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Todos
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/produtos?category=${cat.slug}${search ? `&search=${search}` : ""}`}
                className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                  category === cat.slug
                    ? "bg-gray-900 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}

        {/* Products grid */}
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gray-50 border border-gray-100 flex items-center justify-center text-4xl mb-6 shadow-sm">
              🔍
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum produto encontrado</h3>
            <p className="text-gray-400 mb-8 max-w-xs leading-relaxed">
              {search
                ? `Não encontramos resultados para "${search}". Tente outro termo.`
                : "Esta categoria ainda não tem produtos. Confira as outras!"}
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              {search && (
                <Link href="/produtos" className="px-6 py-3 bg-pink-600 text-white rounded-2xl text-sm font-bold hover:bg-pink-700 transition-colors">
                  Ver todos os produtos
                </Link>
              )}
              <Link href="/" className="px-6 py-3 bg-gray-100 text-gray-700 rounded-2xl text-sm font-bold hover:bg-gray-200 transition-colors">
                Voltar ao início
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
