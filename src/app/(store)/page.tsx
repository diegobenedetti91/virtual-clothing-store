export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/company";
import HeroBanner from "@/components/store/HeroBanner";
import ProductCard from "@/components/store/ProductCard";
import NewArrivalsSection from "@/components/store/NewArrivalsSection";
import Link from "next/link";
import { ArrowRight, Sparkles, ShieldCheck, Truck, RefreshCcw, MessageCircle } from "lucide-react";


import type { Product, Category } from "@/types";

const CATEGORY_BG = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444"];

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  await searchParams;
  const [settings, featuredRaw, newArrivalsRaw, categoriesRaw] = await Promise.all([
    getCompanySettings(),
    prisma.product.findMany({
      where: { active: true, featured: true },
      include: { category: true },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    prisma.product.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.category.findMany({
      where: { active: true },
      include: { _count: { select: { products: { where: { active: true } } } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const featured = featuredRaw as unknown as Product[];
  const newArrivals = newArrivalsRaw as unknown as Product[];
  const categories = categoriesRaw as unknown as Category[];

  const FEATURES = [
    { icon: ShieldCheck, label: "Qualidade garantida", desc: "Peças selecionadas com cuidado" },
    { icon: Truck, label: "Entrega para todo Brasil", desc: "Frete combinado na conversa" },
    { icon: MessageCircle, label: "Atendimento humano", desc: "Suporte rápido pelo WhatsApp" },
    { icon: RefreshCcw, label: "Troca sem burocracia", desc: "Simples e sem complicação" },
  ];

  return (
    <>
      <HeroBanner settings={settings} />

      {/* Features strip */}
      <section className="bg-white border-y border-gray-100 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3 group">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-menu-light flex items-center justify-center group-hover:bg-menu-muted transition-colors">
                  <Icon size={18} className="text-menu" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 leading-tight">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category grid */}
      {categories.length > 0 && (
        <section className="py-14 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-8">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Explorar
                </span>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Compre por categoria</h2>
              </div>
            </div>
            <div className={`grid gap-4 ${categories.length === 1 ? "grid-cols-1 max-w-sm" : categories.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
              {categories.map((cat, i) => (
                <Link
                  key={cat.id}
                  href={`/produtos?category=${cat.slug}`}
                  className="group relative rounded-2xl overflow-hidden aspect-[4/3]"
                >
                  {cat.image ? (
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full" style={{ background: CATEGORY_BG[i % CATEGORY_BG.length] }} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent group-hover:from-black/80 transition-all duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-white font-bold text-base leading-tight">{cat.name}</p>
                    {cat._count != null && (
                      <p className="text-white/65 text-xs mt-0.5">
                        {cat._count.products} {cat._count.products === 1 ? "produto" : "produtos"}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured products */}
      {featured.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand uppercase tracking-widest mb-2">
                  <Sparkles size={12} /> Destaques
                </span>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Peças em destaque</h2>
              </div>
              <Link href="/produtos" className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-brand transition-colors">
                Ver todas <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-8">
              {featured.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}


      {/* Editorial break */}
      <section className="py-20 bg-gray-900 overflow-hidden relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 20% 50%, color-mix(in srgb, var(--brand) 30%, transparent), transparent 60%), radial-gradient(ellipse at 80% 50%, color-mix(in srgb, var(--brand) 15%, transparent), transparent 60%)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {settings?.heroBadge && (
            <p className="text-xs font-bold tracking-widest text-brand uppercase mb-4">{settings.heroBadge}</p>
          )}
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight leading-tight">
            {settings?.heroTitle || settings?.name || "Nossa coleção completa"}
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-md mx-auto leading-relaxed">
            {settings?.description || "Encontre a peça perfeita para cada ocasião"}
          </p>
          <Link
            href="/produtos"
            className="inline-flex items-center gap-2 bg-brand text-white px-10 py-4 rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl text-sm"
          >
            Explorar toda a coleção <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* New arrivals with category filter */}
      <NewArrivalsSection products={newArrivals} />

    </>
  );
}
