"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Tag,
  ShoppingCart,
  Settings,
  LogOut,
  ChevronRight,
  Store,
  Menu,
  X,
  Navigation,
  BarChart2,
  Users,
  Star,
  ShoppingBag,
  Bell,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/categorias", label: "Categorias", icon: Tag },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/admin/menu", label: "Menu da loja", icon: Navigation },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/avaliacoes", label: "Avaliações", icon: Star },
  { href: "/admin/carrinhos", label: "Carrinhos abandonados", icon: ShoppingBag },
  { href: "/admin/lista-de-espera", label: "Lista de espera", icon: Bell },
  { href: "/admin/relatorios", label: "Relatórios", icon: BarChart2 },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

interface AdminSidebarProps {
  user: { name?: string | null; email?: string | null };
}

export default function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const nav = (
    <nav className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2 text-gray-900 font-bold text-lg" target="_blank">
          <Store size={20} className="text-brand" />
          Admin
        </Link>
      </div>

      <div className="flex-1 py-4 px-3 space-y-1">
        {links.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group",
              isActive(href, exact)
                ? "bg-brand text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <Icon size={18} />
            {label}
            {!isActive(href, exact) && <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-50" />}
          </Link>
        ))}
      </div>

      <div className="p-4 border-t border-gray-100">
        <div className="mb-3 px-3">
          <p className="text-xs font-semibold text-gray-900 truncate">{user.name}</p>
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </nav>
  );

  return (
    <>
      <button
        className="md:hidden fixed top-4 left-4 z-50 bg-white p-2 rounded-xl shadow-md border border-gray-100"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-100 shadow-sm z-40 transition-transform duration-300 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {nav}
      </aside>
    </>
  );
}
