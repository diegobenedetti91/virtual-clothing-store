"use client";

import Link from "next/link";
import {
  ShoppingBag, Search, Menu, X, Heart, User, ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useCustomer } from "@/hooks/useCustomer";
import { CompanySettings } from "@/types";
import { cn } from "@/lib/utils";
import { usePathname, useSearchParams } from "next/navigation";

interface NavItemType {
  id: string;
  label: string;
  href: string;
}

interface HeaderProps {
  settings?: CompanySettings | null;
  navItems?: NavItemType[];
}

export default function Header({ settings, navItems = [] }: HeaderProps) {
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

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

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

  const initials = customer
    ? customer.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
    : null;

  const whatsappHref = settings?.whatsapp
    ? `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`
    : null;

  return (
    <>
      <div className="sticky top-0 z-50">
        {/* Main header */}
        <header className={cn(
          "bg-white/95 backdrop-blur-md transition-all duration-300",
          scrolled
            ? "shadow-[0_2px_20px_rgba(0,0,0,0.08)] border-b border-gray-100/80"
            : "border-b border-transparent"
        )}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16 gap-3">

              {/* Logo */}
              <Link
                href="/"
                className="shrink-0 flex items-center transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                {settings?.logo ? (
                  <img src={settings.logo} alt={name} className="h-14 w-auto object-contain" />
                ) : (
                  <span className="font-black text-2xl tracking-tight text-gray-900 hover:text-brand transition-colors">
                    {name}
                  </span>
                )}
              </Link>

              {/* Search bar — desktop */}
              <div className="hidden md:flex flex-1 mx-4">
                <form method="GET" action="/produtos" className="relative w-full group">
                  <Search
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-focus-within:text-menu transition-colors"
                  />
                  <input
                    type="text"
                    name="search"
                    placeholder="Pesquisar produtos..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand focus:bg-white focus:shadow-lg focus:shadow-brand/10 transition-all duration-200"
                  />
                </form>
              </div>

              {/* Right actions */}
              <div className="ml-auto flex items-center gap-0.5">

                {/* Account */}
                <Link
                  href="/conta"
                  className={cn(
                    "relative flex items-center gap-1.5 px-2.5 py-2 rounded-xl transition-all duration-150 active:scale-95",
                    customer
                      ? "text-menu hover:bg-menu-light"
                      : "text-gray-500 hover:text-menu hover:bg-menu-light"
                  )}
                  aria-label="Minha conta"
                >
                  {customer && initials ? (
                    <span className="w-7 h-7 rounded-xl bg-brand text-white text-[11px] font-black flex items-center justify-center shadow-sm">
                      {initials}
                    </span>
                  ) : (
                    <User size={19} />
                  )}
                  {customer && (
                    <span className="hidden sm:inline text-xs font-semibold max-w-[80px] truncate">
                      {customer.name.split(" ")[0]}
                    </span>
                  )}
                </Link>

                {/* Wishlist */}
                <Link
                  href="/favoritos"
                  className="relative p-2.5 rounded-xl text-gray-500 hover:text-menu hover:bg-menu-light transition-all duration-150 active:scale-95"
                  aria-label="Favoritos"
                >
                  <Heart size={19} />
                  {wCount > 0 && (
                    <span className="absolute top-1 right-1 bg-brand text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center leading-none shadow-sm">
                      {wCount > 9 ? "9+" : wCount}
                    </span>
                  )}
                </Link>

                {/* Cart */}
                <Link
                  href="/carrinho"
                  className="relative p-2.5 rounded-xl text-gray-500 hover:text-menu hover:bg-menu-light transition-all duration-150 active:scale-95"
                  aria-label="Carrinho"
                >
                  <ShoppingBag size={19} />
                  <span className={cn(
                    "absolute top-1 right-1 text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center leading-none shadow-sm transition-colors",
                    count > 0 ? "bg-brand text-white" : "bg-gray-200 text-gray-500"
                  )}>
                    {count > 9 ? "9+" : count}
                  </span>
                </Link>

                {/* Search toggle — mobile */}
                <button
                  onClick={() => setSearchOpen((v) => !v)}
                  className={cn(
                    "md:hidden p-2.5 rounded-xl transition-all duration-150 active:scale-95",
                    searchOpen ? "bg-menu-muted text-menu" : "text-gray-500 hover:text-menu hover:bg-menu-light"
                  )}
                  aria-label="Buscar"
                >
                  {searchOpen ? <X size={19} /> : <Search size={19} />}
                </button>

                {/* Hamburger */}
                <button
                  className="p-2.5 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all duration-150 active:scale-95"
                  onClick={() => setMenuOpen(true)}
                  aria-label="Menu"
                >
                  <Menu size={20} />
                </button>
              </div>
            </div>

            {/* Mobile search */}
            <div className={cn(
              "md:hidden overflow-hidden transition-all duration-200",
              searchOpen ? "max-h-20 opacity-100 py-3 border-t border-gray-100" : "max-h-0 opacity-0"
            )}>
              <form method="GET" action="/produtos" className="relative">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  autoFocus={searchOpen}
                  type="text"
                  name="search"
                  placeholder="Pesquisar produtos..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition"
                />
              </form>
            </div>

            {/* Desktop nav bar */}
            <nav className="hidden md:flex items-center gap-0.5 border-t border-gray-100 overflow-x-auto">
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "relative whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition-all duration-200 rounded-t-xl group",
                      active ? "text-menu" : "text-gray-600 hover:text-menu"
                    )}
                  >
                    {link.label}
                    <span className={cn(
                      "absolute bottom-0 left-2 right-2 h-0.5 rounded-full transition-all duration-300",
                      active ? "bg-menu scale-x-100" : "bg-menu scale-x-0 group-hover:scale-x-100"
                    )} />
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
      </div>

      {/* Sidebar overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[60] transition-all duration-300",
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop with blur */}
        <div
          className={cn(
            "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
            menuOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMenuOpen(false)}
        />

        {/* Drawer */}
        <div
          className={cn(
            "absolute right-0 top-0 h-full w-[300px] bg-white flex flex-col shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            menuOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-black/5 hover:bg-black/10 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-all z-10"
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={16} />
          </button>

          {/* User hero section */}
          <div
            className="shrink-0 p-5 pt-6"
            style={{ background: "linear-gradient(135deg, var(--menu), color-mix(in srgb, var(--menu) 55%, #0f172a))" }}
          >
            <div className="flex items-center gap-3 mt-2">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
                {initials ? (
                  <span className="text-base font-black text-white">{initials}</span>
                ) : (
                  <User size={20} className="text-white/80" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm leading-tight truncate">
                  {customer ? customer.name : "Olá, visitante"}
                </p>
                {customer ? (
                  <p className="text-white/60 text-xs mt-0.5 truncate">{customer.email}</p>
                ) : (
                  <Link
                    href="/conta"
                    className="text-white/80 hover:text-white text-xs font-medium underline-offset-2 hover:underline transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Entre ou cadastre-se
                  </Link>
                )}
              </div>
            </div>

            {/* Quick account tabs */}
            <div className="flex gap-2 mt-4">
              <Link
                href="/conta?tab=profile"
                onClick={() => setMenuOpen(false)}
                className="flex-1 text-center text-xs font-bold py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                Minha conta
              </Link>
              <Link
                href="/conta?tab=orders"
                onClick={() => setMenuOpen(false)}
                className="flex-1 text-center text-xs font-bold py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              >
                Meus Pedidos
              </Link>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto py-2">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center justify-between px-5 py-3.5 text-sm font-medium transition-all duration-150 group",
                    active
                      ? "text-menu bg-menu-light border-r-2 border-menu"
                      : "text-gray-700 hover:text-menu hover:bg-gray-50 hover:pl-6"
                  )}
                  onClick={() => setMenuOpen(false)}
                >
                  <span>{link.label}</span>
                  <ChevronRight
                    size={15}
                    className={cn(
                      "transition-transform duration-150",
                      active ? "text-menu" : "text-gray-300 group-hover:text-menu group-hover:translate-x-0.5"
                    )}
                  />
                </Link>
              );
            })}
          </nav>

          {/* Footer actions */}
          <div className="shrink-0 p-4 border-t border-gray-100 space-y-2">
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-2xl transition-colors shadow-sm"
                onClick={() => setMenuOpen(false)}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M11.999 0C5.372 0 0 5.373 0 12c0 2.117.554 4.1 1.523 5.817L.057 23.636a.492.492 0 0 0 .604.64l5.985-1.57A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.81 9.81 0 0 1-5.049-1.395l-.362-.215-3.752.985.996-3.648-.235-.375A9.814 9.814 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z" />
                </svg>
                Falar no WhatsApp
              </a>
            )}
            <Link
              href="/carrinho"
              className="flex items-center justify-between w-full py-2.5 px-4 text-sm font-medium text-gray-600 hover:text-menu rounded-xl hover:bg-gray-50 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <span className="flex items-center gap-2">
                <ShoppingBag size={15} /> Carrinho
              </span>
              {count > 0 && (
                <span className="bg-brand text-white text-[10px] font-black rounded-full px-2 py-0.5">{count}</span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
