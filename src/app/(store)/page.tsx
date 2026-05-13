export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/company";
import HeroBanner from "@/components/store/HeroBanner";
import ProductCard from "@/components/store/ProductCard";
import Link from "next/link";
import { ArrowRight, Sparkles, ShieldCheck, Truck, RefreshCcw, MessageCircle } from "lucide-react";


import type { Product } from "@/types";

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  await searchParams;
  const [settings, featuredRaw, newArrivalsRaw] = await Promise.all([
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
  ]);

  const featured = featuredRaw as unknown as Product[];
  const newArrivals = newArrivalsRaw as unknown as Product[];

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
                <div className="shrink-0 w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center group-hover:bg-pink-100 transition-colors">
                  <Icon size={18} className="text-pink-600" />
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

      {/* Featured products */}
      {featured.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-600 uppercase tracking-widest mb-2">
                  <Sparkles size={12} /> Destaques
                </span>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Peças em destaque</h2>
              </div>
              <Link href="/produtos" className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-pink-600 transition-colors">
                Ver todas <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-8">
              {featured.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* Editorial banner — "Nova coleção" */}
      <section className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-16 px-8 sm:px-14 text-white">
            {/* decorative blobs */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 left-20 w-64 h-64 bg-fuchsia-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-8">
              <div>
                <span className="inline-block text-xs font-bold text-pink-400 uppercase tracking-widest mb-4">Nova coleção</span>
                <h2 className="text-3xl sm:text-4xl font-black leading-tight max-w-sm">
                  Estilo que fala por você, sem precisar dizer nada.
                </h2>
                <p className="text-gray-400 mt-3 max-w-xs text-sm leading-relaxed">
                  {settings?.name ? `Cada peça da ${settings.name} foi escolhida para compor looks modernos e atemporais.` : "Cada peça foi escolhida para compor looks modernos e atemporais."}
                </p>
              </div>
              <Link
                href="/produtos"
                className="shrink-0 inline-flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg shadow-pink-900/30 active:scale-[0.97]"
              >
                Explorar coleção <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* New arrivals */}
      {newArrivals.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Recém chegadas
                </span>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Novidades</h2>
              </div>
              <Link href="/produtos" className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-pink-600 transition-colors">
                Ver todas <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-8">
              {newArrivals.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            <div className="mt-10 text-center sm:hidden">
              <Link href="/produtos" className="inline-flex items-center gap-2 bg-gray-900 text-white font-bold px-8 py-3.5 rounded-2xl hover:bg-gray-800 transition-colors text-sm">
                Ver todos os produtos <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      )}

    </>
  );
}
