"use client";

import Link from "next/link";
import OptimizedImg from "@/components/OptimizedImg";
import {
  ShoppingBag, Search, Menu, X, Heart, User, ChevronRight, Package, Truck, Zap, RefreshCw, CreditCard, ShieldCheck, Store,
  MapPin, LogIn, UserPlus, ArrowRight, Home, Sparkles,
} from "lucide-react";
import { InstagramIcon, WhatsAppIcon } from "@/components/store/BrandIcons";
import { useState, useEffect } from "react";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useCustomer } from "@/hooks/useCustomer";
import { CompanySettings } from "@/types";
import { cn } from "@/lib/utils";
import { storePerks, whatsappLink, type PerkIcon } from "@/lib/storePerks";
import { usePathname, useSearchParams } from "next/navigation";

interface NavItemType {
  id: string;
  label: string;
  href: string;
}
interface CategoryLink {
  id: string;
  name: string;
  slug: string;
  image: string | null;
}
interface ActiveOrder {
  id: string;
  orderNumber: string;
  status: string;
  trackingCode?: string | null;
  shippingMethod?: string | null;
}

interface HeaderProps {
  settings?: CompanySettings | null;
  navItems?: NavItemType[];
  categories?: CategoryLink[];
}

export const PERK_ICONS: Record<PerkIcon, React.ComponentType<{ size?: number; className?: string }>> = {
  pix: Zap,
  truck: Truck,
  store: Store,
  refresh: RefreshCw,
  card: CreditCard,
  shield: ShieldCheck,
};

const ACTIVE_STATUS = ["PENDING", "CONFIRMED", "SHIPPED", "PRONTO_PARA_RETIRADA"];
function activeOrderText(o: ActiveOrder) {
  if (o.status === "PENDING") return "Aguardando pagamento";
  if (o.status === "CONFIRMED") return o.shippingMethod === "retirada" ? "Separando para retirada" : "Preparando o envio";
  if (o.status === "PRONTO_PARA_RETIRADA") return "Pronto para retirar";
  return "A caminho";
}

export default function Header({ settings, navItems = [], categories = [] }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const searchParams = useSearchParams();
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const itemCount = useCart((s) => s.itemCount);
  const wishlistCount = useWishlist((s) => s.count);
  const count = itemCount();
  const wCount = wishlistCount();
  const pathname = usePathname();
  const customer = useCustomer((s) => s.customer);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [perkIndex, setPerkIndex] = useState(0);

  // "Pula" o contador do carrinho quando um item é adicionado
  // (ignora a reidratação do carrinho salvo no navegador)
  const [cartBump, setCartBump] = useState(0);
  useEffect(() => {
    return useCart.subscribe((state, prev) => {
      if (!useCart.persist.hasHydrated()) return;
      if (state.items.length === 0 && prev.items.length === 0) return;
      const qty = (items: typeof state.items) => items.reduce((n, i) => n + i.quantity, 0);
      if (qty(state.items) > qty(prev.items)) setCartBump((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha menus ao trocar de página
  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // Pedido em andamento do cliente (mostrado no menu)
  useEffect(() => {
    if (!menuOpen || !customer) return;
    let cancelled = false;
    fetch("/api/customer/orders")
      .then((r) => r.json())
      .then((list: ActiveOrder[]) => { if (!cancelled && Array.isArray(list)) setActiveOrder(list.find((o) => ACTIVE_STATUS.includes(o.status)) ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [menuOpen, customer]);

  const perks = storePerks(settings);
  const announcements = perks.slice(0, 4);
  useEffect(() => {
    if (announcements.length < 2) return;
    const t = setInterval(() => setPerkIndex((i) => (i + 1) % announcements.length), 4500);
    return () => clearInterval(t);
  }, [announcements.length]);

  const name = settings?.name || "";

  const navLinks = [
    { href: "/", label: "Início" },
    { href: "/produtos", label: "Produtos" },
    ...navItems.map((item) => ({ href: item.href, label: item.label })),
  ];

  const currentSearch = searchParams.toString();
  const hasExactQueryMatch = navLinks.some(({ href }) => {
    const [p, q] = href.split("?");
    return q && pathname === p && currentSearch === new URLSearchParams(q).toString();
  });

  function isActive(href: string) {
    const [p, q] = href.split("?");
    if (q) return pathname === p && currentSearch === new URLSearchParams(q).toString();
    if (hasExactQueryMatch) return false;
    return pathname === href || (href !== "/" && pathname.startsWith(href));
  }
  const activeCategory = pathname === "/produtos" ? searchParams.get("category") : null;

  const initials = customer
    ? customer.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
    : null;

  const whatsappHref = whatsappLink(settings?.whatsapp, "Olá! Vim pelo site e tenho uma dúvida.");
  const instagramHref = settings?.instagram ? `https://instagram.com/${settings.instagram.replace("@", "")}` : null;
  const close = () => setMenuOpen(false);

  const current = announcements[perkIndex % Math.max(1, announcements.length)];
  const CurrentIcon = current ? PERK_ICONS[current.icon] : null;

  return (
    <>
      <div className="sticky top-0 z-50">
        {/* Faixa de avisos */}
        {current && (
          <div className="bg-gray-900 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-8 flex items-center justify-center gap-6 text-[12px]">
              {/* Celular: um aviso por vez; desktop: todos */}
              <p key={perkIndex} className="md:hidden inline-flex items-center gap-1.5 animate-fade-up [animation-duration:0.4s]">
                {CurrentIcon && <CurrentIcon size={13} className="text-white/70" />}
                <b className="font-semibold">{current.title}</b>
                <span className="text-white/60 hidden min-[380px]:inline">· {current.desc}</span>
              </p>
              {announcements.map((p) => {
                const Icon = PERK_ICONS[p.icon];
                return (
                  <p key={p.title} className="hidden md:inline-flex items-center gap-1.5 text-white/90">
                    <Icon size={13} className="text-white/60" /> {p.title}
                  </p>
                );
              })}
            </div>
          </div>
        )}

        {/* Cabeçalho principal */}
        <header className={cn(
          "bg-white/95 backdrop-blur-md transition-all duration-300",
          scrolled ? "shadow-[0_2px_20px_rgba(0,0,0,0.08)] border-b border-gray-100/80" : "border-b border-gray-100"
        )}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={cn("flex items-center gap-3 transition-all duration-300", scrolled ? "h-14" : "h-16")}>
              <button
                className="lg:hidden p-2 -ml-2 rounded-xl text-gray-700 hover:bg-gray-100 active:scale-95"
                onClick={() => setMenuOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu size={22} />
              </button>

              {/* Logo */}
              <Link href="/" className="shrink-0 flex items-center transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]" aria-label={name || "Início"}>
                {settings?.logo ? (
                  <img src={settings.logo} alt={name} className={cn("w-auto object-contain transition-all duration-300", scrolled ? "h-10" : "h-12")} />
                ) : (
                  <span className="font-black text-xl sm:text-2xl tracking-tight text-gray-900">{name}</span>
                )}
              </Link>

              {/* Busca — desktop */}
              <div className="hidden md:flex flex-1 mx-2 lg:mx-6">
                <form method="GET" action="/produtos" className="relative w-full max-w-2xl mx-auto group">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-focus-within:text-menu transition-colors" />
                  <input
                    type="text"
                    name="search"
                    defaultValue={pathname === "/produtos" ? searchParams.get("search") || "" : ""}
                    placeholder="O que você procura hoje?"
                    className="w-full bg-gray-100/80 border border-transparent rounded-full pl-11 pr-24 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:bg-white focus:border-brand focus:shadow-lg transition-all duration-200"
                  />
                  <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-full bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 transition">
                    Buscar
                  </button>
                </form>
              </div>

              {/* Ações */}
              <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
                <button
                  onClick={() => setSearchOpen((v) => !v)}
                  className={cn("md:hidden p-2.5 rounded-xl transition-all active:scale-95", searchOpen ? "bg-menu-muted text-menu" : "text-gray-600 hover:bg-gray-100")}
                  aria-label="Buscar"
                >
                  {searchOpen ? <X size={20} /> : <Search size={20} />}
                </button>

                <Link
                  href="/conta"
                  className="hidden sm:flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full hover:bg-gray-100 transition-all active:scale-95"
                  aria-label="Minha conta"
                >
                  <span className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0", customer ? "bg-brand text-white" : "bg-gray-100 text-gray-600")}>
                    {initials || <User size={16} />}
                  </span>
                  <span className="hidden lg:block text-left leading-tight">
                    <span className="block text-[11px] text-gray-500">{customer ? `Olá, ${customer.name.split(" ")[0]}` : "Olá! Entre"}</span>
                    <span className="block text-[13px] font-semibold text-gray-900">{customer ? "Minha conta" : "ou cadastre-se"}</span>
                  </span>
                </Link>

                <Link href="/favoritos" className="relative p-2.5 rounded-xl text-gray-600 hover:text-menu hover:bg-menu-light transition-all active:scale-95" aria-label="Favoritos">
                  <Heart size={20} />
                  {wCount > 0 && (
                    <span className="absolute top-1 right-1 bg-brand text-white text-[10px] font-black rounded-full min-w-4 h-4 px-1 flex items-center justify-center leading-none shadow-sm">
                      {wCount > 9 ? "9+" : wCount}
                    </span>
                  )}
                </Link>

                <Link href="/carrinho" className="relative p-2.5 rounded-xl text-gray-600 hover:text-menu hover:bg-menu-light transition-all active:scale-95" aria-label="Carrinho">
                  <span key={`bag-${cartBump}`} className={cn("inline-flex", cartBump > 0 && "animate-heart-pop")}>
                    <ShoppingBag size={20} />
                  </span>
                  {count > 0 && (
                    <span key={cartBump} className={cn("absolute top-1 right-1 bg-brand text-white text-[10px] font-black rounded-full min-w-4 h-4 px-1 flex items-center justify-center leading-none shadow-sm", cartBump > 0 && "animate-bump")}>
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </Link>

                <button
                  className="hidden lg:inline-flex p-2.5 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all active:scale-95"
                  onClick={() => setMenuOpen(true)}
                  aria-label="Abrir menu"
                >
                  <Menu size={20} />
                </button>
              </div>
            </div>

            {/* Busca — celular */}
            <div className={cn("md:hidden overflow-hidden transition-all duration-200", searchOpen ? "max-h-20 opacity-100 pb-3" : "max-h-0 opacity-0")}>
              <form method="GET" action="/produtos" className="relative">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  autoFocus={searchOpen}
                  type="text"
                  name="search"
                  placeholder="O que você procura hoje?"
                  className="w-full bg-gray-100 border border-transparent rounded-full pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:bg-white focus:border-brand transition"
                />
              </form>
            </div>

            {/* Navegação — desktop */}
            <nav className={cn("hidden md:flex items-center gap-1 overflow-x-auto [scrollbar-width:none] transition-all duration-300", scrolled ? "h-0 opacity-0 pointer-events-none" : "h-11 opacity-100")}>
              {navLinks.map((link) => {
                const active = isActive(link.href) && !activeCategory;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn("relative whitespace-nowrap px-3 py-2 text-[13px] font-semibold rounded-full transition-all", active ? "text-white bg-gray-900" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100")}
                  >
                    {link.label}
                  </Link>
                );
              })}
              {categories.length > 0 && <span className="w-px h-4 bg-gray-200 mx-1 shrink-0" />}
              {categories.slice(0, 8).map((c) => (
                <Link
                  key={c.id}
                  href={`/produtos?category=${c.slug}`}
                  className={cn("whitespace-nowrap px-3 py-2 text-[13px] font-medium rounded-full transition-all", activeCategory === c.slug ? "text-white bg-gray-900" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100")}
                >
                  {c.name}
                </Link>
              ))}
            </nav>
          </div>
        </header>
      </div>

      {/* Menu lateral */}
      <div className={cn("fixed inset-0 z-[60] transition-all duration-300", menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")} aria-hidden={!menuOpen}>
        <div className={cn("absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300", menuOpen ? "opacity-100" : "opacity-0")} onClick={close} />

        <aside
          className={cn(
            "absolute right-0 top-0 h-full w-[340px] max-w-[88vw] bg-gray-50 flex flex-col shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            menuOpen ? "translate-x-0" : "translate-x-full"
          )}
          role="dialog"
          aria-label="Menu"
        >
          {/* Topo: cliente */}
          <div className="shrink-0 p-5 pb-4 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, var(--menu), color-mix(in srgb, var(--menu) 50%, #0f172a))" }}>
            <span className="absolute -top-16 -right-10 w-44 h-44 rounded-full bg-white/10" />
            <button className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition z-10" onClick={close} aria-label="Fechar menu">
              <X size={16} />
            </button>
            <div className="relative flex items-center gap-3 pr-8">
              <span className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 font-bold">
                {initials || <User size={20} />}
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-tight truncate">{customer ? `Olá, ${customer.name.split(" ")[0]}!` : "Olá! Bem-vindo(a)"}</p>
                <p className="text-white/70 text-xs mt-0.5 truncate">{customer ? customer.email : "Entre para acompanhar seus pedidos"}</p>
              </div>
            </div>
            {!customer && (
              <div className="relative grid grid-cols-2 gap-2 mt-4">
                <Link href="/conta/login" onClick={close} className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl bg-white text-gray-900 hover:bg-white/90"><LogIn size={14} /> Entrar</Link>
                <Link href="/conta/registro" onClick={close} className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl bg-white/15 hover:bg-white/25"><UserPlus size={14} /> Criar conta</Link>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Pedido em andamento */}
            {customer && activeOrder && (
              <Link href={`/pedido/${activeOrder.id}`} onClick={close} className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-white ring-1 ring-gray-200/70 p-3 hover:shadow-md transition">
                <span className="w-10 h-10 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0"><Truck size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-gray-500">Pedido {activeOrder.orderNumber}</span>
                  <span className="block text-sm font-semibold text-gray-900 truncate">{activeOrderText(activeOrder)}</span>
                </span>
                <ArrowRight size={16} className="text-gray-400" />
              </Link>
            )}

            {/* Atalhos */}
            <div className="grid grid-cols-4 gap-2 px-4 mt-4">
              {[
                { href: "/conta?tab=orders", label: "Pedidos", icon: Package },
                { href: "/favoritos", label: "Favoritos", icon: Heart, badge: wCount },
                { href: "/carrinho", label: "Carrinho", icon: ShoppingBag, badge: count },
                { href: customer ? "/conta?tab=profile" : "/conta/login", label: "Conta", icon: User },
              ].map(({ href, label, icon: Icon, badge }) => (
                <Link key={label} href={href} onClick={close} className="relative flex flex-col items-center gap-1 rounded-2xl bg-white ring-1 ring-gray-200/70 py-3 text-[11px] font-medium text-gray-700 hover:text-menu hover:ring-gray-300 transition">
                  <Icon size={18} />
                  {label}
                  {!!badge && badge > 0 && <span className="absolute top-1.5 right-2 bg-brand text-white text-[9px] font-black rounded-full min-w-4 h-4 px-1 flex items-center justify-center">{badge > 9 ? "9+" : badge}</span>}
                </Link>
              ))}
            </div>

            {/* Navegação */}
            <nav className="mt-5 px-4">
              <p className="px-1 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Navegar</p>
              <div className="rounded-2xl bg-white ring-1 ring-gray-200/70 overflow-hidden divide-y divide-gray-100">
                {navLinks.map((link, i) => {
                  const active = isActive(link.href) && !activeCategory;
                  const Icon = i === 0 ? Home : i === 1 ? Sparkles : ChevronRight;
                  return (
                    <Link key={link.href} href={link.href} onClick={close} className={cn("flex items-center gap-3 px-4 py-3 text-sm font-medium transition", active ? "text-menu bg-menu-light" : "text-gray-700 hover:bg-gray-50")}>
                      <Icon size={16} className={active ? "text-menu" : "text-gray-400"} />
                      <span className="flex-1">{link.label}</span>
                      <ChevronRight size={15} className="text-gray-300" />
                    </Link>
                  );
                })}
              </div>
            </nav>

            {categories.length > 0 && (
              <div className="mt-5 px-4">
                <p className="px-1 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Categorias</p>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((c) => (
                    <Link key={c.id} href={`/produtos?category=${c.slug}`} onClick={close} className={cn("flex items-center gap-2 rounded-xl bg-white ring-1 p-2 text-[13px] font-medium transition", activeCategory === c.slug ? "ring-[var(--menu)] text-menu" : "ring-gray-200/70 text-gray-700 hover:ring-gray-300")}>
                      <span className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-gray-400">
                        {c.image ? <OptimizedImg src={c.image} widths={[160]} sizes="40px" loading="lazy" alt="" className="w-full h-full object-cover" /> : c.name[0]}
                      </span>
                      <span className="truncate">{c.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Vantagens */}
            <div className="mt-5 px-4">
              <p className="px-1 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Por que comprar aqui</p>
              <ul className="rounded-2xl bg-white ring-1 ring-gray-200/70 p-3 space-y-2.5">
                {perks.map((p) => {
                  const Icon = PERK_ICONS[p.icon];
                  return (
                    <li key={p.title} className="flex items-start gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-menu-light text-menu flex items-center justify-center shrink-0"><Icon size={14} /></span>
                      <span className="leading-tight">
                        <span className="block text-[13px] font-semibold text-gray-900">{p.title}</span>
                        <span className="block text-[11px] text-gray-500">{p.desc}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Contato */}
            {(settings?.address || instagramHref) && (
              <div className="mt-5 px-4 pb-4 space-y-2 text-[12px] text-gray-500">
                {settings?.address && <p className="flex items-start gap-2"><MapPin size={13} className="mt-0.5 shrink-0" /> {settings.address}</p>}
                {instagramHref && (
                  <a href={instagramHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-gray-900"><InstagramIcon size={13} /> {settings?.instagram}</a>
                )}
              </div>
            )}
          </div>

          {whatsappHref && (
            <div className="shrink-0 p-4 border-t border-gray-200 bg-white">
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={close} className="flex items-center justify-center gap-2 w-full py-3 bg-[#25D366] hover:brightness-95 text-white text-sm font-semibold rounded-2xl transition shadow-sm">
                <WhatsAppIcon size={17} /> Dúvidas? Fale no WhatsApp
              </a>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
