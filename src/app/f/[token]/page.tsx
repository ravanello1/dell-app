import type { Metadata } from "next";
import { Clock, ShieldCheck } from "lucide-react";
import { getPublicByToken } from "@/modules/anamnese/anamnese.service";
import { isAppError } from "@/core/api/errors";
import { studio } from "@/core/config/studio";
import { DellMark } from "@/ui/brand";
import { PublicAnamneseForm } from "@/modules/anamnese/components/public-anamnese-form";
import type { PublicAnamneseDto } from "@/modules/anamnese/anamnese.dto";

/**
 * Página pública da anamnese, aberta pela cliente por um link com token.
 *
 * Metadata neutra de propósito: o cartão de prévia do WhatsApp (que busca a URL)
 * não mostra nome nem dado nenhum da cliente. `noindex` mantém a página fora de
 * buscadores, e `no-referrer` evita que a URL com token vaze para terceiros.
 */
export const metadata: Metadata = {
  title: `Ficha de anamnese — ${studio.name}`,
  description: "Preenchimento da ficha de anamnese.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicAnamnesePage({ params }: PageProps) {
  const { token } = await params;

  let data: PublicAnamneseDto | null = null;
  try {
    data = await getPublicByToken(token);
  } catch (error) {
    if (!(isAppError(error) && error.code === "NOT_FOUND")) throw error;
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-4 py-8">
      <header className="mb-6 flex flex-col items-center text-center">
        <DellMark className="size-14" />
        <h1 className="mt-3 font-display text-2xl text-ink-900">Ficha de anamnese</h1>
        <p className="text-sm text-ink-500">
          {studio.name} · {studio.city}/{studio.state}
        </p>
      </header>

      {data === null || data.state === "EXPIRED" ? (
        <Notice
          tone="warning"
          icon={<Clock className="size-6" aria-hidden />}
          title={data === null ? "Link inválido" : "Link expirado"}
          message={
            data === null
              ? "Este link não é válido. Confira se copiou o endereço completo ou peça um novo ao studio."
              : "Este link expirou. Chame o studio no WhatsApp para receber um novo."
          }
        />
      ) : data.state === "SUBMITTED" ? (
        <Notice
          tone="success"
          icon={<ShieldCheck className="size-6" aria-hidden />}
          title={`Recebido, ${data.clientFirstName}!`}
          message="Sua ficha já foi enviada ao studio. Você vai confirmar e assinar junto com a profissional no dia do atendimento. Obrigada!"
        />
      ) : data.state === "SIGNED" ? (
        <Notice
          tone="success"
          icon={<ShieldCheck className="size-6" aria-hidden />}
          title="Ficha já finalizada"
          message="Esta ficha já foi concluída e assinada. Não é preciso fazer mais nada."
        />
      ) : (
        <PublicAnamneseForm token={token} data={data} />
      )}

      <p className="mt-8 text-center text-xs leading-relaxed text-ink-400">
        Seus dados são usados só para o seu atendimento e protegidos conforme a LGPD.
      </p>
    </main>
  );
}

function Notice({
  tone,
  icon,
  title,
  message,
}: {
  tone: "success" | "warning";
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  const toneClass =
    tone === "success"
      ? "border-success/25 bg-success-soft text-success"
      : "border-warning/25 bg-warning-soft text-warning";
  return (
    <div className="rounded-(--radius-card) border border-line bg-surface p-6 text-center shadow-(--shadow-card)">
      <span
        className={`mx-auto flex size-14 items-center justify-center rounded-full border ${toneClass}`}
      >
        {icon}
      </span>
      <h2 className="mt-4 text-lg font-medium text-ink-900">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{message}</p>
    </div>
  );
}
