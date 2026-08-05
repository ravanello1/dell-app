import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cn } from "@/core/utils/cn";
import type { ComponentProps } from "react";

const variants = {
  /** Ação principal — o rosa da marca. */
  primary:
    "bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-300",
  /** Ação secundária — branco com o fio de ouro. */
  secondary:
    "bg-surface text-ink-900 border border-line-strong hover:bg-gold-50 hover:border-gold-400 active:bg-gold-100",
  /** Terciária, sem peso visual. */
  ghost: "text-ink-700 hover:bg-gold-50 hover:text-gold-800 active:bg-gold-100",
  /** Destrutiva — cancelar, excluir. */
  danger: "bg-danger text-white hover:brightness-110 active:brightness-95 disabled:opacity-50",
  /** Discreta e destrutiva, para ações dentro de listas. */
  dangerGhost: "text-danger hover:bg-danger-soft active:brightness-95",
} as const;

const sizes = {
  /** 44px de altura mínima: alvo de toque confortável no celular. */
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  icon: "h-11 w-11 shrink-0",
} as const;

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  /** Renderiza no elemento filho (para usar como <Link>). */
  asChild?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  asChild = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(
        "inline-flex select-none items-center justify-center rounded-(--radius-field) font-medium",
        "transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          <span>Aguarde…</span>
        </>
      ) : (
        children
      )}
    </Component>
  );
}
