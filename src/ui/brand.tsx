import Image from "next/image";
import { cn } from "@/core/utils/cn";

/**
 * Marca do Dell Beauty Studio: a concha rosa perolada no aro dourado.
 *
 * É a identidade visual do studio, a mesma arte do ícone do app e do favicon
 * (`public/brand/dell-logo.png`). Trocar a imagem ali atualiza a marca em todo
 * o app. Servida com `unoptimized` de propósito: assim é um `<img>` direto para
 * o arquivo, que o service worker consegue guardar para o app abrir offline.
 */

/** Só a arte, recortada num disco. Herda o tamanho de quem a contém. */
export function DellMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-block shrink-0 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-gold-200/70",
        className,
      )}
    >
      <Image
        src="/brand/dell-logo.png"
        alt="Dell Beauty Studio"
        fill
        sizes="128px"
        unoptimized
        className="object-cover"
      />
    </span>
  );
}

/** Assinatura para cabeçalhos e tela de entrada: marca + nome. */
export function DellWordmark({
  className,
  subtitle,
}: {
  className?: string;
  subtitle?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <DellMark className="size-9" />
      <div className="min-w-0 leading-tight">
        <p className="font-display text-lg font-semibold tracking-tight text-ink-900">
          Dell <span className="text-gold-700">App</span>
        </p>
        {subtitle && <p className="truncate text-[11px] text-ink-400">{subtitle}</p>}
      </div>
    </div>
  );
}
