"use client";

import Link from "next/link";
import { ShoppingBag, Search, Menu, X, Heart, User } from "lucide-react";
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

  return (
    <>
      <header className={cn(
        "sticky top-0 z-50 bg-white/95 backdrop-blur-md transition-all duration-200",
        scrolled ? "shadow-sm border-b border-gray-100" : "border-b border-transparent"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-6">

            {/* Brand */}
            <Link href="/" className="shrink-0 flex items-center">
              {settings?.logo ? (
                <img src={settings.logo} alt={name} className="h-9 w-auto object-contain" />
              ) : (
                <span className="font-black text-xl tracking-tight text-gray-900 hover:text-brand transition-colors">
                  {name}
                </span>
              )}
            </Link>

            {/* Nav — desktop */}
            <nav className="hidden md:flex items-center gap-1 ml-2">
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "relative px-4 py-2 text-sm font-semibold rounded-xl transition-colors",
                      active
                        ? "text-menu bg-menu-muted"
                        : "text-gray-700 hover:text-menu hover:bg-menu-light"
                    )}
                  >
                    {link.label}
                    {active && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand-light0 rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-1">
              {/* Search toggle */}
              <button
                onClick={() => setSearchOpen((v) => !v)}
                className={cn(
                  "p-2.5 rounded-xl transition-colors",
                  searchOpen ? "bg-menu-muted text-menu" : "text-gray-500 hover:text-menu hover:bg-menu-light"
                )}
                aria-label="Buscar"
              >
                <Search size={19} />
              </button>

              {/* Account */}
              <Link
                href="/conta"
                className={cn(
                  "relative p-2.5 rounded-xl transition-colors flex items-center gap-1.5",
                  customer
                    ? "text-menu hover:bg-menu-light"
                    : "text-gray-500 hover:text-menu hover:bg-menu-light"
                )}
                aria-label="Minha conta"
              >
                <User size={19} />
                {customer && (
                  <span className="hidden sm:inline text-xs font-semibold max-w-[80px] truncate">
                    {customer.name.split(" ")[0]}
                  </span>
                )}
              </Link>

              {/* Wishlist */}
              <Link
                href="/favoritos"
                className="relative p-2.5 rounded-xl text-gray-500 hover:text-menu hover:bg-menu-light transition-colors"
                aria-label="Favoritos"
              >
                <Heart size={19} />
                {wCount > 0 && (
                  <span className="absolute top-1 right-1 bg-brand text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {wCount > 9 ? "9+" : wCount}
                  </span>
                )}
              </Link>

              {/* Cart */}
              <Link
                href="/carrinho"
                className="relative p-2.5 rounded-xl text-gray-500 hover:text-menu hover:bg-menu-light transition-colors"
                aria-label="Carrinho"
              >
                <ShoppingBag size={19} />
                {count > 0 && (
                  <span className="absolute top-1 right-1 bg-brand text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </Link>

              {/* Mobile menu toggle */}
              <button
                className="md:hidden p-2.5 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Menu"
              >
                {menuOpen ? <X size={19} /> : <Menu size={19} />}
              </button>
            </div>
          </div>

          {/* Search bar — expandable */}
          {searchOpen && (
            <div className="border-t border-gray-100 py-3">
              <form method="GET" action="/produtos" className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  name="search"
                  placeholder="Buscar produtos..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition"
                />
              </form>
            </div>
          )}
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors",
                      active
                        ? "bg-menu-muted text-menu"
                        : "text-gray-700 hover:text-menu hover:bg-menu-light"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <Link
                href="/carrinho"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ShoppingBag size={16} />
                Carrinho
                {count > 0 && (
                  <span className="ml-auto bg-brand text-white text-xs font-bold rounded-full px-2 py-0.5">
                    {count}
                  </span>
                )}
              </Link>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
