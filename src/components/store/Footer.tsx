import Link from "next/link";
import { CookiePreferencesButton } from "@/components/store/CookieConsent";
import { Phone, MapPin, Mail, Lock, Truck, Zap, Store, RefreshCw, CreditCard, ShieldCheck } from "lucide-react";
import { CompanySettings } from "@/types";
import { StoreStats } from "./StoreStats";
import { InstagramIcon, WhatsAppIcon } from "./BrandIcons";
import { storePerks, whatsappLink, type PerkIcon } from "@/lib/storePerks";

interface FooterProps {
  settings?: CompanySettings | null;
  categories?: { id: string; name: string; slug: string }[];
}

const ICONS: Record<PerkIcon, React.ComponentType<{ size?: number; className?: string }>> = {
  pix: Zap, truck: Truck, store: Store, refresh: RefreshCw, card: CreditCard, shield: ShieldCheck,
};

function formatPhone(p: string) {
  const d = p.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
}

export default function Footer({ settings, categories = [] }: FooterProps) {
  const name = settings?.name || "Minha Loja";
  const year = new Date().getFullYear();
  const perks = storePerks(settings).slice(0, 4);
  const wa = whatsappLink(settings?.whatsapp, "Olá! Vim pelo site e tenho uma dúvida.");
  const ig = settings?.instagram ? `https://instagram.com/${settings.instagram.replace("@", "")}` : null;
  const email = (settings as { email?: string | null } | null | undefined)?.email;

  const payments = [
    settings?.pixDiscountEnabled || settings?.mercadoPagoAtivo || settings?.infinityPayAtivo ? "Pix" : null,
    settings?.mercadoPagoAtivo || settings?.infinityPayAtivo ? "Cartão de crédito" : null,
    settings?.mercadoPagoAtivo ? "Cartão de débito" : null,
    settings?.mercadoPagoAtivo || settings?.infinityPayAtivo ? "Boleto" : null,
    settings?.nuPayAtivo ? "NuPay" : null,
  ].filter(Boolean) as string[];

  const linkCls = "text-sm text-gray-400 hover:text-white transition-colors";
  const titleCls = "text-white text-sm font-semibold mb-4";

  return (
    <footer className="bg-gray-950 text-gray-400 mt-20">
      {/* Vantagens */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {perks.map((p) => {
            const Icon = ICONS[p.icon];
            return (
              <div key={p.title} className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-2xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-white shrink-0"><Icon size={19} /></span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-white">{p.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 lg:grid-cols-12 gap-10">
          {/* Marca */}
          <div className="col-span-2 lg:col-span-4">
            {settings?.logo ? (
              <img src={settings.logo} alt={name} className="h-14 w-auto object-contain rounded-xl bg-white p-1.5" />
            ) : (
              <p className="text-white font-black text-2xl tracking-tight">{name}</p>
            )}
            {settings?.description && <p className="text-sm leading-relaxed mt-4 max-w-sm">{settings.description}</p>}
            <div className="flex gap-2 mt-5">
              {ig && (
                <a href={ig} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-10 h-10 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition">
                  <InstagramIcon size={18} />
                </a>
              )}
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="w-10 h-10 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-gray-300 hover:text-[#25D366] hover:bg-white/10 transition">
                  <WhatsAppIcon size={18} />
                </a>
              )}
            </div>
            <div className="mt-6"><StoreStats /></div>
          </div>

          {/* Loja */}
          <div className="lg:col-span-2">
            <p className={titleCls}>Loja</p>
            <ul className="space-y-2.5">
              <li><Link href="/" className={linkCls}>Início</Link></li>
              <li><Link href="/produtos" className={linkCls}>Todos os produtos</Link></li>
              {categories.slice(0, 5).map((c) => (
                <li key={c.id}><Link href={`/produtos?category=${c.slug}`} className={linkCls}>{c.name}</Link></li>
              ))}
            </ul>
          </div>

          {/* Ajuda */}
          <div className="lg:col-span-2">
            <p className={titleCls}>Minha conta</p>
            <ul className="space-y-2.5">
              <li><Link href="/conta" className={linkCls}>Minha conta</Link></li>
              <li><Link href="/conta?tab=orders" className={linkCls}>Meus pedidos</Link></li>
              <li><Link href="/favoritos" className={linkCls}>Favoritos</Link></li>
              <li><Link href="/conta?tab=orders" className={linkCls}>Trocas e devoluções</Link></li>
              <li><CookiePreferencesButton className={linkCls} /></li>
            </ul>
          </div>

          {/* Atendimento */}
          {(wa || settings?.phone || email || ig || settings?.address) && <div className="col-span-2 lg:col-span-4">
            <p className={titleCls}>Atendimento</p>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:brightness-95 transition">
                <WhatsAppIcon size={16} /> Fale com a gente no WhatsApp
              </a>
            )}
            <ul className="mt-4 space-y-2.5 text-sm">
              {settings?.phone && <li className="flex items-center gap-2.5"><Phone size={15} className="text-gray-500 shrink-0" />{formatPhone(settings.phone)}</li>}
              {email && <li className="flex items-center gap-2.5"><Mail size={15} className="text-gray-500 shrink-0" /><a href={`mailto:${email}`} className="hover:text-white">{email}</a></li>}
              {ig && <li className="flex items-center gap-2.5"><InstagramIcon size={15} className="text-gray-500 shrink-0" /><a href={ig} target="_blank" rel="noopener noreferrer" className="hover:text-white">{settings?.instagram}</a></li>}
              {settings?.address && <li className="flex items-start gap-2.5"><MapPin size={15} className="text-gray-500 shrink-0 mt-0.5" /><span>{settings.address}</span></li>}
            </ul>
          </div>}
        </div>

        {/* Pagamento e segurança */}
        {payments.length > 0 && (
          <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">Formas de pagamento</p>
              <div className="flex flex-wrap gap-1.5">
                {payments.map((p) => (
                  <span key={p} className="px-2.5 py-1 rounded-lg bg-white/5 ring-1 ring-white/10 text-xs text-gray-300">{p}</span>
                ))}
              </div>
            </div>
            <p className="inline-flex items-center gap-2 text-xs text-gray-400">
              <Lock size={14} className="text-emerald-400" /> Site seguro · seus dados protegidos
            </p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
          <p>© {year} {name}{settings?.cnpj ? ` · CNPJ ${settings.cnpj}` : ""}. Todos os direitos reservados.</p>
          <p>Desenvolvido por Diego Benedetti</p>
        </div>
      </div>
    </footer>
  );
}
