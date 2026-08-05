import { cn } from "@/core/utils/cn";

/**
 * Marca do Dell App: um leque de cílios sobre o dourado da casa.
 * Desenhada só com traços — sem texto — para funcionar do favicon de 32px ao
 * ícone de 512px do PWA sem depender de fonte carregada.
 */

/** Só o desenho, sem fundo. Herda a cor de quem o contém. */
export function DellLashes({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="none" className={className} aria-hidden>
      <g
        stroke="currentColor"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* linha de base — a pálpebra */}
        <path d="M118 300 Q256 372 394 300" />
        {/* fios, do canto interno ao externo, ganhando comprimento */}
        <path d="M150 316 Q158 246 176 206" />
        <path d="M204 340 Q212 250 236 190" />
        <path d="M262 348 Q268 240 288 176" />
        <path d="M320 338 Q332 246 356 192" />
        <path d="M370 312 Q384 250 406 214" />
      </g>
    </svg>
  );
}

/** Marca completa: disco dourado com o leque em branco. */
export function DellMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-white shadow-sm",
        className,
      )}
    >
      <DellLashes className="size-[68%]" />
    </span>
  );
}

/** Assinatura para cabeçalhos e tela de entrada. */
export function DellWordmark({
  className,
  subtitle,
}: {
  className?: string;
  subtitle?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <DellMark className="size-9 shrink-0" />
      <div className="min-w-0 leading-tight">
        <p className="font-display text-lg font-semibold tracking-tight text-ink-900">
          Dell <span className="text-gold-700">App</span>
        </p>
        {subtitle && <p className="truncate text-[11px] text-ink-400">{subtitle}</p>}
      </div>
    </div>
  );
}
