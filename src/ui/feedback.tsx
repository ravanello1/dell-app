import { Loader2 } from "lucide-react";
import { cn } from "@/core/utils/cn";
import type { ReactNode } from "react";

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2 className={cn("size-5 animate-spin text-gold-600", className)} aria-hidden />
  );
}

export function LoadingBlock({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-600">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

/** Estado vazio: diz o que aconteceu e oferece o próximo passo. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-gold-50 text-gold-600 ring-1 ring-gold-200">
          {icon}
        </div>
      )}
      <p className="font-display text-lg text-ink-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-(--radius-card) border border-danger/25 bg-danger-soft px-4 py-3.5 text-sm text-danger"
    >
      <p className="font-medium">Não foi possível carregar</p>
      <p className="mt-0.5 text-danger/85">{message}</p>
      {retry && <div className="mt-3">{retry}</div>}
    </div>
  );
}

/** Bloco cinza que ocupa o espaço enquanto os dados não chegam. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-sunken", className)} />;
}
