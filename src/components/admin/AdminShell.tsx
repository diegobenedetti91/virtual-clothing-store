"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import { signOut } from "next-auth/react";
import { ChevronDown, ChevronRight, CornerDownLeft, ExternalLink, LogOut, Menu, Search, Store, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "./ui/Button";
import type { AdminBadges } from "@/lib/adminAlerts";
import { ADMIN_NAV, ALL_LINKS, findActive, type NavLink } from "./adminNav";

interface Props {
  user: { name?: string | null; email?: string | null };
  badges: AdminBadges;
  storeName?: string | null;
  logo?: string | null;
  children: React.ReactNode;
}

const COLLAPSED_KEY = "admin-nav-collapsed";

function Badge({ link, badges, active }: { link: NavLink; badges: AdminBadges; active: boolean }) {
  const n = link.badge ? badges[link.badge] : 0;
  if (!n) return null;
  const critical = link.badgeTone === "critical";
  return (
    <span
      className={cn(
        "ml-auto min-w-5 h-5 px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center tabular-nums",
        critical ? "bg-red-500 text-white" : active ? "bg-white/25 text-white" : "bg-gray-100 text-gray-600"
      )}
      title={critical ? "Precisa de atenção" : undefined}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

export default function AdminShell({ user, badges, storeName, logo, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const active = findActive(pathname);

  // Grupos recolhidos ficam salvos no navegador
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do localStorage após a hidratação
      if (Array.isArray(saved)) setCollapsed(saved);
    } catch {}
  }, []);
  const toggleGroup = (title: string) => {
    setCollapsed((prev) => {
      const next = prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title];
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Ctrl/Cmd + K abre a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initials = (user.name || user.email || "A").split(/[\s@]/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const sidebar = (
    <nav className="flex flex-col h-full">
      <div className="h-16 px-5 flex items-center gap-2.5 border-b border-gray-100 shrink-0">
        {logo ? (
          <img src={logo} alt={storeName || "Loja"} className="h-8 w-auto max-w-[120px] object-contain" />
        ) : (
          <span className="w-8 h-8 rounded-xl bg-brand text-white flex items-center justify-center shadow-sm">
            <Store size={16} />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{storeName || "Minha loja"}</p>
          <p className="text-[11px] text-gray-400 leading-tight">Painel administrativo</p>
        </div>
      </div>

      <div className="px-3 pt-3 shrink-0">
        <Button
          size="sm"
          fullWidth
          icon={Search}
          onClick={() => { setPaletteOpen(true); setMobileOpen(false); }}
          className="justify-start bg-gray-50 font-normal text-gray-400 ring-gray-200/70 shadow-none hover:bg-gray-100 hover:text-gray-600"
        >
          Buscar página…
          <kbd className="ml-auto text-[10px] font-medium text-gray-400 bg-white ring-1 ring-gray-200 rounded px-1.5 py-0.5">Ctrl K</kbd>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-4 [scrollbar-width:thin]">
        {ADMIN_NAV.map((group) => {
          const isCollapsed = collapsed.includes(group.title) && !group.links.some((l) => l.href === active?.href);
          const groupBadges = group.links.reduce((s, l) => s + (l.badge && l.badgeTone === "critical" ? badges[l.badge] : 0), 0);
          return (
            <div key={group.title}>
              {group.title !== "Início" && (
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center gap-1 px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {group.title}
                  {isCollapsed && groupBadges > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 ml-1" />}
                  <ChevronDown size={12} className={cn("ml-auto transition-transform", isCollapsed && "-rotate-90")} />
                </button>
              )}
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
                )}
              >
                <div className="overflow-hidden space-y-0.5">
                  {group.links.map((link) => {
                    const isActive = active?.href === link.href;
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        title={link.description}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "relative flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 group",
                          isActive
                            ? "bg-brand text-white shadow-[0_6px_16px_-6px_color-mix(in_srgb,var(--brand)_40%,transparent)]"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        )}
                      >
                        <Icon size={17} className={cn("shrink-0 transition-transform", !isActive && "text-gray-400 group-hover:text-gray-700 group-hover:scale-110")} />
                        <span className="truncate">{link.label}</span>
                        <Badge link={link} badges={badges} active={isActive} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-gray-100 shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <span className="w-8 h-8 rounded-full bg-gray-900 text-white text-[11px] font-semibold flex items-center justify-center shrink-0">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-900 truncate">{user.name || "Administrador"}</p>
            <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
          </div>
          <Button
            variant="dangerGhost"
            size="icon"
            icon={LogOut}
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            aria-label="Sair"
          />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="admin-root min-h-screen bg-[#f6f7f9]">
      {/* Sidebar desktop */}
      <aside className="hidden md:block fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200/70 z-30">{sidebar}</aside>

      {/* Sidebar mobile */}
      <div className={cn("md:hidden fixed inset-0 z-50 transition", mobileOpen ? "visible" : "invisible")}>
        <div
          className={cn("absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity", mobileOpen ? "opacity-100" : "opacity-0")}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Button variant="ghost" size="icon" icon={X} onClick={() => setMobileOpen(false)} aria-label="Fechar menu" className="absolute top-4 right-3 z-10 text-gray-400" />
          {sidebar}
        </aside>
      </div>

      <div className="md:pl-64">
        {/* Barra superior */}
        <header className="sticky top-0 z-20 h-16 bg-[#f6f7f9]/80 backdrop-blur-md border-b border-gray-200/60">
          <div className="h-full px-4 md:px-8 flex items-center gap-3">
            <Button variant="ghost" size="icon" icon={Menu} onClick={() => setMobileOpen(true)} aria-label="Abrir menu" className="md:hidden -ml-1 hover:bg-white [&_svg]:size-5" />
            <nav aria-label="Você está em" className="flex items-center gap-1.5 text-[13px] min-w-0">
              {active && active.group !== "Início" && (
                <>
                  <span className="text-gray-400 hidden sm:inline">{active.group}</span>
                  <ChevronRight size={14} className="text-gray-300 hidden sm:inline" />
                </>
              )}
              <span className="font-semibold text-gray-900 truncate">{active?.label || "Painel"}</span>
              {active && <span className="hidden lg:inline text-gray-400 truncate">· {active.description}</span>}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="icon" icon={Search} onClick={() => setPaletteOpen(true)} aria-label="Buscar página" className="md:hidden hover:bg-white" />
              <ButtonLink href="/" target="_blank" size="sm" icon={ExternalLink} aria-label="Ver loja" className="max-sm:w-8 max-sm:px-0">
                <span className="hidden sm:inline">Ver loja</span>
              </ButtonLink>
            </div>
          </div>
        </header>

        <ViewTransition name="admin-page">
          <main className="px-4 md:px-8 py-6 md:py-8">{children}</main>
        </ViewTransition>
      </div>

      {paletteOpen && <CommandPalette badges={badges} onClose={() => setPaletteOpen(false)} onGo={(href) => { setPaletteOpen(false); router.push(href); }} />}
    </div>
  );
}

/* ───────────── Busca rápida (Ctrl K) ───────────── */

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function CommandPalette({ badges, onClose, onGo }: { badges: AdminBadges; onClose: () => void; onGo: (href: string) => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const nq = normalize(q.trim());
    if (!nq) return ALL_LINKS;
    return ALL_LINKS.filter((l) => normalize(`${l.label} ${l.description} ${l.group} ${l.keywords || ""}`).includes(nq));
  }, [q]);

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && results[sel]) onGo(results[sel].href);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-fade-up [animation-duration:0.2s]" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden animate-fade-up [animation-duration:0.25s]">
        <div className="flex items-center gap-3 px-4 border-b border-gray-100">
          <Search size={18} className="text-gray-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            placeholder="Para onde você quer ir? Ex.: etiqueta, bling, estoque…"
            className="flex-1 py-4 text-sm outline-none bg-transparent !shadow-none !border-0"
          />
          <kbd className="text-[10px] text-gray-400 ring-1 ring-gray-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-gray-400">Nada encontrado para “{q}”</li>}
          {results.map((l, i) => {
            const Icon = l.icon;
            const n = l.badge ? badges[l.badge] : 0;
            return (
              <li key={l.href}>
                <button
                  type="button"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => onGo(l.href)}
                  className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors", i === sel ? "bg-gray-100" : "")}
                >
                  <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", i === sel ? "bg-brand text-white" : "bg-gray-100 text-gray-500")}>
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-900">
                      {l.label} <span className="text-xs font-normal text-gray-400">· {l.group}</span>
                    </span>
                    <span className="block text-xs text-gray-500 truncate">{l.description}</span>
                  </span>
                  {n > 0 && (
                    <span className={cn("text-[11px] font-semibold rounded-full px-1.5 tabular-nums", l.badgeTone === "critical" ? "bg-red-500 text-white" : "bg-gray-200 text-gray-600")}>{n}</span>
                  )}
                  {i === sel && <CornerDownLeft size={14} className="text-gray-400" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
