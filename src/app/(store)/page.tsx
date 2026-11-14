export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import OptimizedImg from "@/components/OptimizedImg";
import { getPublicCompanySettings } from "@/lib/company";
import HeroBanner from "@/components/store/HeroBanner";
import ProductCard from "@/components/store/ProductCard";
import NewArrivalsSection from "@/components/store/NewArrivalsSection";
import RecentlyViewed from "@/components/store/RecentlyViewed";
import { absoluteUrl, siteUrl } from "@/lib/site";
import Link from "next/link";
import { applyFlashSales } from "@/lib/flashSales";
import { ArrowRight, Sparkles, ShieldCheck, Truck, RefreshCcw, MessageCircle } from "lucide-react";


import type { Product, Category } from "@/types";

const CATEGORY_BG = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444"];

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  await searchParams;
  const [settings, featuredRaw, newArrivalsRaw, categoriesRaw] = await Promise.all([
    getPublicCompanySettings(),
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

  const featured = (await applyFlashSales(featuredRaw)) as unknown as Product[];

  // Dados da loja para o Google (nome, logo, redes e busca interna)
  const insta = settings?.instagram?.replace(/^@/, "").trim();
  const orgLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ClothingStore",
        name: settings?.name,
        url: siteUrl(),
        ...(settings?.logo ? { logo: absoluteUrl(settings.logo), image: absoluteUrl(settings.logo) } : {}),
        ...(settings?.description ? { description: settings.description } : {}),
        ...(settings?.phone || settings?.whatsapp ? { telephone: settings.phone || settings.whatsapp } : {}),
        ...(insta ? { sameAs: [`https://instagram.com/${insta}`] } : {}),
      },
      {
        "@type": "WebSite",
        name: settings?.name,
        url: siteUrl(),
        potentialAction: { "@type": "SearchAction", target: `${siteUrl()}/produtos?search={search_term_string}`, "query-input": "required name=search_term_string" },
      },
    ],
  };
  const newArrivals = (await applyFlashSales(newArrivalsRaw)) as unknown as Product[];
  const categories = categoriesRaw as unknown as Category[];

  const shippingLabel = settings?.freteAtivo && settings?.freteTipo === "local"
    ? `Entrega local${settings.freteLocalCidade ? ` em ${settings.freteLocalCidade}` : ""}`
    : "Entrega para todo Brasil";
  const shippingDesc = settings?.freteAtivo && settings?.freteTipo === "local"
    ? "Entregamos dentro da cidade"
    : "Frete combinado na conversa";

  const FEATURES = [
    { icon: ShieldCheck, label: "Qualidade garantida", desc: "Peças selecionadas com cuidado" },
    { icon: Truck, label: shippingLabel, desc: shippingDesc },
    { icon: MessageCircle, label: "Atendimento humano", desc: "Suporte rápido pelo WhatsApp" },
    { icon: RefreshCcw, label: "Troca sem burocracia", desc: "Simples e sem complicação" },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd).replace(/</g, "\\u003c") }} />
      <HeroBanner settings={settings} />

      {/* Features strip — letreiro infinito no celular, grade no desktop */}
      <section className="bg-white border-y border-gray-100 py-5 md:py-6 overflow-hidden">
        <div className="md:hidden relative [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
          <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 gap-8 pr-8" aria-hidden={copy === 1}>
                {FEATURES.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-center gap-3 shrink-0">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-menu-light flex items-center justify-center">
                      <Icon size={18} className="text-menu" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 leading-tight whitespace-nowrap">{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 whitespace-nowrap">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-4 gap-6">
            {FEATURES.map(({ icon: Icon, label, desc }, i) => (
              <div
                key={label}
                data-reveal
                style={{ "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}
                className="flex items-center gap-3 group"
              >
                <div className="shrink-0 w-10 h-10 rounded-xl bg-menu-light flex items-center justify-center group-hover:bg-menu-muted group-hover:-translate-y-0.5 group-hover:rotate-[-4deg] transition-all duration-300">
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

      {/* Category circles */}
      {categories.length > 0 && (
        <section className="py-14 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 data-reveal className="text-2xl font-bold text-gray-900 text-center mb-10 tracking-tight">
              Compre por Categoria
            </h2>
            <div className="flex flex-wrap justify-center gap-6 sm:gap-8 lg:gap-10">
              {categories.map((cat, i) => (
                <Link
                  key={cat.id}
                  href={`/produtos?category=${cat.slug}`}
                  data-reveal
                  style={{ "--reveal-delay": `${Math.min(i, 8) * 60}ms` } as React.CSSProperties}
                  className="group flex flex-col items-center gap-3"
                >
                  <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-2 border-gray-200 ring-0 ring-offset-2 group-hover:ring-2 ring-[var(--menu)] group-hover:border-transparent group-hover:-translate-y-1 transition-all duration-300 shadow-sm group-hover:shadow-lg">
                    {cat.image ? (
                      <OptimizedImg
                        src={cat.image}
                        widths={[160, 320]}
                        sizes="128px"
                        loading="lazy"
                        alt={cat.name}
                        className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ background: CATEGORY_BG[i % CATEGORY_BG.length] }}
                      >
                        <span className="text-white font-black text-2xl">
                          {cat.name[0]}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-menu transition-colors text-center">
                    {cat.name}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Novidades */}
      <NewArrivalsSection products={newArrivals} />

      {/* Featured products */}
      {featured.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div data-reveal className="flex items-end justify-between mb-10">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand uppercase tracking-widest mb-2">
                  <Sparkles size={12} /> Destaques
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Peças em destaque</h2>
              </div>
              <Link href="/produtos" className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-brand transition-colors">
                Ver todas <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-8">
              {featured.map((p, i) => (
                <div key={p.id} data-reveal style={{ "--reveal-delay": `${i * 90}ms` } as React.CSSProperties}>
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Só aparece para quem já abriu algum produto neste navegador */}
      <RecentlyViewed className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" />

      {/* Convite final */}
      <section className="py-14 bg-gray-900 overflow-hidden relative">
        <div
          className="absolute -inset-[20%] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 30% 50%, color-mix(in srgb, var(--brand) 28%, transparent), transparent 60%)" }}
        />
        <div data-reveal className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Ainda não encontrou a sua peça?</h2>
            <p className="text-gray-400 mt-1">Veja a coleção completa, com filtros por tamanho, preço e promoções.</p>
          </div>
          <Link
            href="/produtos"
            className="group shrink-0 inline-flex items-center gap-2 bg-brand text-on-button px-8 py-3.5 rounded-xl font-semibold hover:-translate-y-0.5 transition-all shadow-xl text-sm"
          >
            Ver toda a coleção <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>


    </>
  );
}
