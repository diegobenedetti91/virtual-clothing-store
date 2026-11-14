import Link from "next/link";
import { ArrowLeft, CreditCard, RefreshCw, ShieldCheck, Store, Truck, Zap } from "lucide-react";
import type { Perk, PerkIcon } from "@/lib/storePerks";

export interface AuthBrand {
  storeName: string;
  logo: string | null;
  /** Mantido por compatibilidade; a moldura não usa mais foto de fundo */
  heroImage: string | null;
  perks: Perk[];
}

const ICONS: Record<PerkIcon, React.ComponentType<{ size?: number; className?: string }>> = {
  pix: Zap, truck: Truck, store: Store, refresh: RefreshCw, card: CreditCard, shield: ShieldCheck,
};

/**
 * Moldura das telas de conta: um cartão centralizado dentro da página da loja
 * (cabeçalho e rodapé continuam visíveis). No desktop, uma faixa estreita com a
 * cor da loja, o logo e as vantagens; no celular, só o formulário.
 */
export default function AuthShell({ brand, eyebrow, title, children }: { brand: AuthBrand; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50/80 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] rounded-3xl bg-white ring-1 ring-gray-200/70 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.25)] overflow-hidden">
        {/* Faixa da marca (desktop) */}
        <aside
          className="relative hidden lg:flex flex-col justify-between gap-10 overflow-hidden p-10 text-on-brand"
          style={{ background: "linear-gradient(150deg, var(--brand), color-mix(in srgb, var(--brand) 40%, #0b0b14))" }}
        >
          <span className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10 blur-2xl" />
          <span className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-black/10 blur-2xl" />

          <div className="relative">
            {brand.logo ? (
              <img src={brand.logo} alt={brand.storeName} className="h-14 w-auto max-w-[180px] object-contain rounded-xl shadow-sm" />
            ) : (
              <span className="inline-flex items-center gap-2.5">
                <span className="w-11 h-11 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center"><Store size={20} /></span>
                <span className="font-semibold">{brand.storeName}</span>
              </span>
            )}
          </div>

          <div className="relative">
            <p className="text-xs font-medium opacity-75 uppercase tracking-widest">{eyebrow}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight leading-snug">{title}</h2>
            <ul className="mt-7 space-y-3">
              {brand.perks.slice(0, 4).map((p) => {
                const Icon = ICONS[p.icon];
                return (
                  <li key={p.title} className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-white/15 ring-1 ring-white/20 flex items-center justify-center shrink-0"><Icon size={15} /></span>
                    <span className="leading-tight">
                      <span className="block text-sm font-medium">{p.title}</span>
                      <span className="block text-xs opacity-70">{p.desc}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="relative text-xs opacity-50">© {new Date().getFullYear()} {brand.storeName}</p>
        </aside>

        {/* Formulário */}
        <main className="px-5 py-8 sm:px-10 sm:py-10">
          {/* Marca no celular */}
          <div className="lg:hidden flex items-center gap-2.5 mb-6">
            {brand.logo ? (
              <img src={brand.logo} alt={brand.storeName} className="h-10 w-auto max-w-[140px] object-contain rounded-lg" />
            ) : (
              <span className="w-10 h-10 rounded-xl bg-brand text-on-button flex items-center justify-center"><Store size={18} /></span>
            )}
            <span className="text-sm font-semibold text-gray-900 truncate">{brand.storeName}</span>
          </div>
          <div className="mx-auto w-full max-w-md">
            {children}
            <p className="mt-8 text-center">
              <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700"><ArrowLeft size={14} /> Voltar à loja</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
