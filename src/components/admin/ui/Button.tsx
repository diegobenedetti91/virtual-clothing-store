"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Botão padrão do admin. Use SEMPRE este componente (ou ButtonLink) em vez de
 * montar classes à mão, para todos os botões terem o mesmo tamanho, foco,
 * estado de carregando e desabilitado.
 *
 * - primary:   ação principal da tela (Salvar, Criar, Novo …) — cor da loja
 * - dark:      próximo passo de um fluxo (Marcar enviado, Confirmar pagamento)
 * - secondary: ação secundária com contorno (Cancelar, Exportar, Filtrar)
 * - ghost:     ação discreta sem fundo (Editar, Ver mais, links de ação)
 * - danger:    ação destrutiva confirmada (Excluir definitivo, Cancelar pedido)
 * - dangerGhost: excluir discreto (ícone de lixeira em listas)
 * - success:   confirmação positiva (Aprovar, Aprovar e publicar)
 *
 * ATENÇÃO em páginas de servidor (sem "use client"): não passe `icon`, `iconRight`
 * nem `onClick` — componentes e funções não atravessam do servidor para o
 * navegador (erro React #441 em produção). Coloque o ícone como filho:
 *   <ButtonLink href="…"><Plus /> Novo</ButtonLink>
 * e não chame buttonClasses() no servidor.
 */
export type ButtonVariant = "primary" | "dark" | "secondary" | "ghost" | "danger" | "dangerGhost" | "success";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon" | "iconSm";

const BASE =
  "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-semibold select-none " +
  "transition-[background-color,color,box-shadow,transform,opacity] duration-150 " +
  "active:scale-[0.97] disabled:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-on-button shadow-[0_6px_16px_-8px_color-mix(in_srgb,var(--brand)_70%,transparent)] hover:brightness-[1.06] hover:shadow-[0_8px_20px_-8px_color-mix(in_srgb,var(--brand)_80%,transparent)]",
  dark: "bg-gray-900 text-white shadow-sm hover:bg-gray-800",
  secondary: "bg-white text-gray-700 ring-1 ring-inset ring-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-gray-50 hover:text-gray-900 hover:ring-gray-300",
  ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
  dangerGhost: "text-gray-400 hover:bg-red-50 hover:text-red-600",
  success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
};

// Compactos de propósito: o admin tem muita informação por tela
const SIZES: Record<ButtonSize, string> = {
  xs: "h-7 px-2 text-[11px] rounded-md gap-1 [&_svg]:size-3",
  sm: "h-8 px-2.5 text-xs rounded-lg [&_svg]:size-3.5",
  md: "h-9 px-3.5 text-[13px] rounded-lg [&_svg]:size-4",
  lg: "h-10 px-4 text-sm rounded-xl [&_svg]:size-4",
  icon: "h-8 w-8 rounded-lg [&_svg]:size-4",
  iconSm: "h-7 w-7 rounded-md [&_svg]:size-3.5",
};

export function buttonClasses({ variant = "secondary", size = "md", fullWidth, className }: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; className?: string } = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className);
}

type IconType = React.ComponentType<{ size?: number; className?: string }>;

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ícone à esquerda (componente do lucide) */
  icon?: IconType;
  /** Ícone à direita */
  iconRight?: IconType;
  fullWidth?: boolean;
  /** Mostra spinner, desabilita e mantém a largura */
  loading?: boolean;
  /** Texto exibido enquanto carrega (padrão: o mesmo texto) */
  loadingText?: React.ReactNode;
}

export type ButtonProps = CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon: Icon, iconRight: IconRight, fullWidth, loading, loadingText, className, children, disabled, type = "button", ...rest },
  ref
) {
  const iconOnly = size === "icon" || size === "iconSm";
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      title={rest.title ?? (iconOnly ? (rest["aria-label"] as string | undefined) : undefined)}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" /> : Icon ? <Icon /> : null}
      {loading && loadingText !== undefined && !iconOnly ? loadingText : !(loading && iconOnly) ? children : null}
      {!loading && IconRight ? <IconRight /> : null}
    </button>
  );
});

export type ButtonLinkProps = CommonProps & Omit<React.ComponentProps<typeof Link>, "className"> & { className?: string };

/** Link com aparência de botão (navegação). Para ações, use Button. */
export function ButtonLink({ variant = "secondary", size = "md", icon: Icon, iconRight: IconRight, fullWidth, className, children, loading: _l, loadingText: _t, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth, className })} {...rest}>
      {Icon ? <Icon /> : null}
      {children}
      {IconRight ? <IconRight /> : null}
    </Link>
  );
}
