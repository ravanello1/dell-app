"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/core/utils/cn";
import type { ReactNode } from "react";

/**
 * Diálogo que muda de forma conforme a tela: no celular sobe do rodapé como
 * uma folha (o polegar alcança os botões), no desktop centraliza. É o mesmo
 * componente — só a animação e o ancoramento mudam no breakpoint.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  title,
  description,
  children,
  footer,
  className,
  size = "md",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px]",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-surface shadow-(--shadow-float)",
          // Celular: folha ancorada no rodapé, com altura limitada.
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl",
          // Desktop: caixa centralizada.
          "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2",
          "sm:max-h-[88dvh] sm:w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
          size === "lg" ? "sm:max-w-3xl" : "sm:max-w-lg",
          "border border-line",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <DialogPrimitive.Title className="truncate text-lg text-ink-900">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-sm text-ink-600">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            aria-label="Fechar"
            className="-mr-1 -mt-1 rounded-full p-2 text-ink-600 transition-colors hover:bg-gold-50 hover:text-gold-800"
          >
            <X className="size-5" />
          </DialogPrimitive.Close>
        </div>

        <div className="scrollbar-slim flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-4 py-3 pb-safe sm:flex-row sm:justify-end sm:px-5 sm:pb-3">
            {footer}
          </div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
