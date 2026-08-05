"use client";

import Image from "next/image";
import { Printer } from "lucide-react";
import { formatDateTime } from "@/core/utils/date";
import { cn } from "@/core/utils/cn";
import { studio } from "@/core/config/studio";
import { Button } from "@/ui/button";
import { anamneseGroups } from "../anamnese.questions";
import type { AnamneseDto } from "../anamnese.dto";

/**
 * Ficha assinada, em modo leitura — e o alvo da impressão.
 *
 * As variantes `print:` transformam a mesma tela num documento limpo: fundo
 * branco, sem sombras, assinaturas lado a lado. A cliente e a profissional que
 * aparecem aqui vêm do snapshot congelado na assinatura, não do cadastro atual.
 */
export function AnamneseView({ anamnese }: { anamnese: AnamneseDto }) {
  const snap = anamnese.snapshot;

  return (
    <div className="flex flex-col gap-4 print:gap-3 print:text-black">
      {/* Barra de ações — some na impressão. */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <p className="text-sm font-medium text-success">Ficha assinada</p>
          {anamnese.signedAt && (
            <p className="text-xs text-ink-500">
              em {formatDateTime(new Date(anamnese.signedAt))}
            </p>
          )}
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          Imprimir / PDF
        </Button>
      </div>

      {/* Documento. */}
      <article className="overflow-hidden rounded-(--radius-card) border border-line bg-surface p-5 print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-7">
        {/* Cabeçalho do documento — só aparece bem na impressão. */}
        <header className="mb-5 border-b border-line pb-4 text-center">
          <h1 className="font-display text-2xl text-ink-900">Ficha de Anamnese</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {studio.name} · {studio.city}/{studio.state}
          </p>
        </header>

        {/* Identificação (snapshot). */}
        {snap && (
          <section className="mb-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <DocField label="Cliente" value={snap.client.name} className="col-span-2 sm:col-span-2" />
            <DocField label="Telefone" value={snap.client.phone} />
            {snap.client.birthDate && (
              <DocField label="Nascimento" value={snap.client.birthDate.split("-").reverse().join("/")} />
            )}
            {anamnese.signedAt && (
              <DocField label="Data" value={formatDateTime(new Date(anamnese.signedAt))} />
            )}
          </section>
        )}

        {/* Respostas. */}
        <section className="flex flex-col gap-4">
          {anamneseGroups.map((group) => (
            <div key={group.id} className="break-inside-avoid">
              <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gold-700">
                {group.title}
              </h2>
              <dl className="divide-y divide-line">
                {group.questions.map((q) => {
                  const answer = anamnese.answers[q.id];
                  const yes = answer?.value ?? false;
                  return (
                    <div key={q.id} className="flex items-start justify-between gap-3 py-1.5">
                      <dt className="text-sm text-ink-800">
                        {q.label}
                        {yes && answer?.detail && (
                          <span className="mt-0.5 block text-xs text-ink-500">{answer.detail}</span>
                        )}
                      </dt>
                      <dd
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          yes
                            ? "bg-rose-100 text-rose-700 print:bg-transparent print:text-black print:ring-1 print:ring-ink-900"
                            : "text-ink-400",
                        )}
                      >
                        {yes ? "SIM" : "não"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </section>

        {anamnese.observations && (
          <section className="mt-4 break-inside-avoid">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gold-700">
              Observações
            </h2>
            <p className="whitespace-pre-wrap text-sm text-ink-800">{anamnese.observations}</p>
          </section>
        )}

        {/* Declaração + assinaturas. */}
        {snap && (
          <section className="mt-6 break-inside-avoid border-t border-line pt-4">
            <p className="mb-6 text-xs leading-relaxed text-ink-600">{snap.declaration}</p>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <SignatureBlock
                image={anamnese.clientSignature}
                name={snap.client.name}
                caption="Cliente"
              />
              <SignatureBlock
                image={anamnese.professionalSignature}
                name={snap.professional.name}
                caption={`${snap.professional.title} · ${snap.professional.documentLabel} ${snap.professional.document}`}
              />
            </div>
          </section>
        )}
      </article>
    </div>
  );
}

function DocField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="text-ink-900">{value}</dd>
    </div>
  );
}

function SignatureBlock({
  image,
  name,
  caption,
}: {
  image?: string | null;
  name: string;
  caption: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex h-24 items-end justify-center border-b border-ink-900">
        {image ? (
          // A assinatura é um data URI PNG gerado pelo próprio app.
          <Image
            src={image}
            alt={`Assinatura de ${name}`}
            width={320}
            height={96}
            unoptimized
            className="max-h-24 w-auto object-contain"
          />
        ) : null}
      </div>
      <p className="mt-1 text-center text-sm font-medium text-ink-900">{name}</p>
      <p className="text-center text-[11px] text-ink-500">{caption}</p>
    </div>
  );
}
