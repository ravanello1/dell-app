"use client";

import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/core/utils/cn";

/**
 * Um campo de formulário acessível sem cerimônia.
 *
 * `<Field>` gera os ids e conecta rótulo, dica e mensagem de erro ao controle
 * via `aria-describedby` e `aria-invalid`. Quem usa só escreve o `<Input>` — a
 * ligação acontece pelo contexto, então não dá para esquecer.
 */

interface FieldContextValue {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldControl() {
  const context = useContext(FieldContext);
  return {
    id: context?.controlId,
    "aria-describedby": context?.describedBy,
    "aria-invalid": context?.invalid || undefined,
  } as const;
}

export interface FieldProps {
  label: string;
  /** Texto de apoio abaixo do rótulo. */
  hint?: string;
  error?: string | string[];
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const baseId = useId();
  const controlId = `${baseId}-control`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;

  const message = Array.isArray(error) ? error[0] : error;
  const invalid = Boolean(message);

  const describedBy = [hint ? hintId : null, invalid ? errorId : null].filter(Boolean).join(" ");

  return (
    <FieldContext.Provider
      value={{ controlId, describedBy: describedBy || undefined, invalid }}
    >
      <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
        <label htmlFor={controlId} className="text-sm font-medium text-ink-700">
          {label}
          {required && (
            <span className="ml-0.5 text-rose-600" aria-hidden>
              *
            </span>
          )}
        </label>

        {hint && (
          <p id={hintId} className="-mt-0.5 text-xs text-ink-400">
            {hint}
          </p>
        )}

        {children}

        {/* `break-words` porque uma mensagem longa e sem espaços (as do Zod
            costumam ser) empurraria a largura do formulário inteiro. */}
        {invalid && (
          <p
            id={errorId}
            role="alert"
            className="break-words text-xs font-medium text-balance text-danger"
          >
            {message}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

/** Estilo compartilhado por input, textarea e select — mantém a família coesa. */
export const controlClassName = cn(
  "w-full rounded-(--radius-field) border border-line-strong bg-surface",
  "px-3 py-2.5 text-[16px] text-ink-900 leading-tight", // 16px evita o zoom automático do Safari iOS
  "placeholder:text-ink-400",
  "transition-colors duration-150",
  "hover:border-gold-400",
  "focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-200",
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-400",
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20",
  "sm:text-sm",
);

export function Input({ className, ...props }: ComponentProps<"input">) {
  const field = useFieldControl();
  return <input {...field} {...props} className={cn(controlClassName, className)} />;
}

export function Textarea({ className, rows = 3, ...props }: ComponentProps<"textarea">) {
  const field = useFieldControl();
  return (
    <textarea
      rows={rows}
      {...field}
      {...props}
      className={cn(controlClassName, "resize-y", className)}
    />
  );
}

/**
 * Select nativo, de propósito. No celular ele abre o seletor do próprio sistema
 * — rolagem por inércia, busca por digitação, acessibilidade pronta — coisas
 * que um listbox customizado só imita mal.
 */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  const field = useFieldControl();
  return (
    <div className="relative">
      <select
        {...field}
        {...props}
        className={cn(controlClassName, "appearance-none pr-9", className)}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gold-600"
      >
        <path
          d="M6 8l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
