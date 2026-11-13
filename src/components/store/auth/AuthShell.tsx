import Link from "next/link";
import { ArrowLeft, CreditCard, RefreshCw, ShieldCheck, Store, Truck, Zap } from "lucide-react";
import type { Perk, PerkIcon } from "@/lib/storePerks";

export interface AuthBrand {
  storeName: string;
  logo: string | null;
  heroImage: string | null;
  perks: Perk[];
}

const ICONS: Record<PerkIcon, React.ComponentType<{ size?: number; className?: string }>> = {
  pix: Zap, truck: Truck, store: Store, refresh: RefreshCw, card: CreditCard, shield: ShieldCheck,
};

/** Moldura das telas de conta: marca da loja à esquerda (desktop) e formulário à direita. */
export default function AuthShell({ brand, eyebrow, title, children }: { brand: AuthBrand; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-140px)] grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] bg-white">
      {/* Painel da marca */}
      <aside
        className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10 xl:p-14 text-white"
        style={{ background: "linear-gradient(145deg, var(--brand), color-mix(in srgb, var(--brand) 45%, #0b0b14))" }}
      >
        {brand.heroImage && <img src={brand.heroImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-luminosity" />}
        <span className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-2xl animate-glow-drift" />

        <div className="relative">
          {brand.logo ? (
            <img src={brand.logo} alt={brand.storeName} className="h-16 w-auto object-contain rounded-2xl bg-white p-2 shadow-sm" />
          ) : (
            <span className="inline-flex w-14 h-14 rounded-2xl bg-white/20 ring-1 ring-white/30 items-center justify-center"><Store size={24} /></span>
          )}
        </div>

        <div className="relative max-w-md">
          <p className="text-sm font-medium text-white/70 uppercase tracking-widest">{eyebrow}</p>
          <h2 className="mt-2 text-3xl xl:text-4xl font-semibold tracking-tight leading-tight">{title}</h2>
          <ul className="mt-8 space-y-3">
            {brand.perks.map((p) => {
              const Icon = ICONS[p.icon];
              return (
                <li key={p.title} className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center shrink-0"><Icon size={16} /></span>
                  <span className="leading-tight">
                    <span className="block text-sm font-semibold">{p.title}</span>
                    <span className="block text-xs text-white/70">{p.desc}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} {brand.storeName}</p>
      </aside>

      {/* Conteúdo */}
      <main className="flex justify-center px-4 sm:px-8 py-10 lg:py-14" style={{ background: "radial-gradient(ellipse at top, color-mix(in srgb, var(--brand) 6%, white), white 55%)" }}>
        <div className="w-full max-w-md">
          {children}
          <p className="mt-8 text-center">
            <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700"><ArrowLeft size={14} /> Voltar à loja</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
