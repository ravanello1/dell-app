import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { DellMark } from "@/ui/brand";

export const metadata: Metadata = { title: "Sem conexão" };

/** Página servida pelo service worker quando a navegação falha por falta de rede. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-muted px-6 text-center">
      <DellMark className="size-14" />
      <div className="flex items-center gap-2 text-gold-700">
        <WifiOff className="size-5" aria-hidden />
        <h1 className="text-2xl text-ink-900">Sem conexão</h1>
      </div>
      <p className="max-w-xs text-sm leading-relaxed text-ink-600">
        As telas que você já abriu continuam disponíveis. Assim que o sinal voltar, o app sincroniza
        sozinho.
      </p>
    </main>
  );
}
