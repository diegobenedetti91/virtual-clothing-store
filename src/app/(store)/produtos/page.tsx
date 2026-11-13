import { prisma } from "@/lib/prisma";
import { applyFlashSales } from "@/lib/flashSales";
import ProductCard from "@/components/store/ProductCard";
import Link from "next/link";
import { Search, ChevronRight, X, SlidersHorizontal, Tag, PackageCheck, LayoutGrid, SearchX } from "lucide-react";
import type { Product } from "@/types";

type Sort = "recent" | "price_asc" | "price_desc" | "name";
interface Params { category?: string; search?: string; menu?: string; sort?: string; promo?: string; stock?: string }
interface PageProps {
  searchParams: Promise<Params>;
}

const SORTS: { key: Sort; label: string }[] = [
  { key: "recent", label: "Novidades" },
  { key: "price_asc", label: "Menor preço" },
  { key: "price_desc", label: "Maior preço" },
  { key: "name", label: "A–Z" },
];
const CATEGORY_BG = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444"];

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { category, search, menu } = params;
  const sort: Sort = SORTS.some((s) => s.key === params.sort) ? (params.sort as Sort) : "recent";
  const onlyPromo = params.promo === "1";
  const onlyStock = params.stock === "1";

  const [categories, productsRaw, activeNavItem] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
      include: { _count: { select: { products: { where: { active: true } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: {
        active: true,
        ...(category ? { category: { slug: category } } : {}),
        ...(menu ? { navItems: { some: { id: menu } } } : {}),
        ...(search ? { OR: [{ name: { contains: search } }, { description: { contains: search } }] } : {}),
        ...(onlyStock ? { stock: { gt: 0 } } : {}),
      },
      include: { category: true, navItems: { select: { id: true, label: true } } },
      orderBy: { createdAt: "desc" },
    }),
    menu ? prisma.navItem.findUnique({ where: { id: menu } }) : null,
  ]);

  // Preço com promoção relâmpago aplicada, para filtrar e ordenar pelo que o cliente paga
  let products = (await applyFlashSales(productsRaw)) as unknown as Product[];
  if (onlyPromo) products = products.filter((p) => p.flashSale || (p.comparePrice && p.comparePrice > p.price));
  if (sort === "price_asc") products = [...products].sort((a, b) => a.price - b.price);
  if (sort === "price_desc") products = [...products].sort((a, b) => b.price - a.price);
  if (sort === "name") products = [...products].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const visibleCategories = categories.filter((c) => c._count.products > 0);
  const activeCategory = categories.find((c) => c.slug === category);
  const totalActive = categories.reduce((s, c) => s + c._count.products, 0);

  /** Monta a URL mantendo os filtros atuais e trocando só o que mudou. */
  const href = (patch: Partial<Params>) => {
    const next: Record<string, string | undefined> = { category, search, menu, sort: sort === "recent" ? undefined : sort, promo: onlyPromo ? "1" : undefined, stock: onlyStock ? "1" : undefined, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/produtos?${qs}` : "/produtos";
  };

  const title = activeNavItem ? activeNavItem.label : activeCategory ? activeCategory.name : search ? `Resultados para “${search}”` : "Todos os produtos";
  const activeFilters = [
    search && { label: `Busca: ${search}`, remove: href({ search: undefined }) },
    activeNavItem && { label: activeNavItem.label, remove: href({ menu: undefined }) },
    onlyPromo && { label: "Em promoção", remove: href({ promo: undefined }) },
    onlyStock && { label: "Disponíveis", remove: href({ stock: undefined }) },
  ].filter(Boolean) as { label: string; remove: string }[];

  return (
    <div className="bg-white min-h-screen">
      {/* Cabeçalho da página */}
      <div className="border-b border-gray-100 bg-gradient-to-b from-gray-50/80 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-5">
          <nav className="flex items-center gap-1 text-xs text-gray-400 mb-2" aria-label="Você está em">
            <Link href="/" className="hover:text-gray-700">Início</Link>
            <ChevronRight size={12} />
            <Link href="/produtos" className={activeCategory || search || activeNavItem ? "hover:text-gray-700" : "text-gray-600 font-medium"}>Produtos</Link>
            {activeCategory && (<><ChevronRight size={12} /><span className="text-gray-600 font-medium">{activeCategory.name}</span></>)}
          </nav>
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{title}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {products.length === 0 ? "Nenhum produto encontrado" : `${products.length} produto${products.length !== 1 ? "s" : ""}${activeCategory ? " nesta categoria" : ""}`}
              </p>
            </div>
            <form method="GET" action="/produtos" className="md:ml-auto w-full md:w-80 relative group">
              {category && <input type="hidden" name="category" value={category} />}
              {menu && <input type="hidden" name="menu" value={menu} />}
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder={activeCategory ? `Buscar em ${activeCategory.name}` : "Buscar produtos"}
                className="w-full rounded-full border border-gray-200 bg-white pl-10 pr-20 py-2.5 text-sm placeholder:text-gray-400 shadow-sm focus:outline-none focus:border-brand"
              />
              <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 py-1.5 rounded-full bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800">Buscar</button>
            </form>
          </div>

          {/* Categorias */}
          {visibleCategories.length > 0 && (
            <div className="relative mt-5 -mx-4 sm:mx-0">
              <div className="flex gap-3 sm:gap-4 overflow-x-auto px-4 sm:px-1 pt-1.5 pb-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <Link href={href({ category: undefined })} className="group snap-start shrink-0 flex flex-col items-center gap-1.5 w-[72px]">
                  <span className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${!category ? "ring-2 ring-offset-2 ring-gray-900 bg-gray-900 text-white" : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"}`}>
                    <LayoutGrid size={22} />
                  </span>
                  <span className={`text-xs text-center leading-tight ${!category ? "font-semibold text-gray-900" : "text-gray-600"}`}>Todos</span>
                  <span className="text-[10px] text-gray-400 -mt-1">{totalActive}</span>
                </Link>
                {visibleCategories.map((cat, i) => {
                  const active = category === cat.slug;
                  return (
                    <Link key={cat.id} href={href({ category: active ? undefined : cat.slug })} className="group snap-start shrink-0 flex flex-col items-center gap-1.5 w-[72px]" aria-current={active ? "page" : undefined}>
                      <span className={`w-16 h-16 rounded-full overflow-hidden transition-all duration-300 ${active ? "ring-2 ring-offset-2 ring-gray-900" : "ring-1 ring-gray-200 group-hover:ring-gray-400 group-hover:-translate-y-0.5"}`}>
                        {cat.image ? (
                          <img src={cat.image} alt="" className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-white font-bold text-lg" style={{ background: CATEGORY_BG[i % CATEGORY_BG.length] }}>
                            {cat.name[0]}
                          </span>
                        )}
                      </span>
                      <span className={`text-xs text-center leading-tight line-clamp-2 ${active ? "font-semibold text-gray-900" : "text-gray-600 group-hover:text-gray-900"}`}>{cat.name}</span>
                      <span className="text-[10px] text-gray-400 -mt-1">{cat._count.products}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barra de ordenação e filtros */}
      <div className="sticky top-[88px] z-20 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <SlidersHorizontal size={15} className="text-gray-400 shrink-0" />
          <div className="inline-flex rounded-full bg-gray-100 p-0.5 shrink-0">
            {SORTS.map((s) => (
              <Link key={s.key} href={href({ sort: s.key === "recent" ? undefined : s.key })} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${sort === s.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>
                {s.label}
              </Link>
            ))}
          </div>
          <Link href={href({ promo: onlyPromo ? undefined : "1" })} className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ring-1 transition ${onlyPromo ? "bg-red-50 text-red-700 ring-red-200" : "text-gray-600 ring-gray-200 hover:bg-gray-50"}`}>
            <Tag size={13} /> Em promoção
          </Link>
          <Link href={href({ stock: onlyStock ? undefined : "1" })} className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ring-1 transition ${onlyStock ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "text-gray-600 ring-gray-200 hover:bg-gray-50"}`}>
            <PackageCheck size={13} /> Disponíveis
          </Link>
          {activeFilters.map((f) => (
            <Link key={f.label} href={f.remove} className="shrink-0 inline-flex items-center gap-1 pl-3 pr-2 py-1.5 rounded-full bg-gray-900 text-white text-xs font-medium hover:bg-gray-800" title="Remover filtro">
              {f.label} <X size={12} />
            </Link>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="w-16 h-16 rounded-2xl bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center mb-5"><SearchX size={28} className="text-gray-300" /></span>
            <h2 className="text-lg font-semibold text-gray-900">Nada por aqui</h2>
            <p className="text-sm text-gray-500 mt-1 mb-6 max-w-sm">
              {search ? `Não encontramos nada para “${search}”. Tente outra palavra ou veja as categorias acima.` : "Nenhum produto com esses filtros. Que tal tirar algum filtro?"}
            </p>
            <div className="flex gap-2 flex-wrap justify-center">
              {(activeFilters.length > 0 || category) && (
                <Link href="/produtos" className="px-5 py-2.5 bg-gray-900 text-white rounded-full text-sm font-semibold hover:bg-gray-800">Limpar filtros</Link>
              )}
              <Link href="/" className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold hover:bg-gray-200">Voltar ao início</Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
            {products.map((product, i) => (
              <div key={product.id} data-reveal style={{ "--reveal-delay": `${(i % 5) * 70}ms` } as React.CSSProperties}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
