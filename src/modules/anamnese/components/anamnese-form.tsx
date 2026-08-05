"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, MessageCircle, Save, ShieldCheck, X } from "lucide-react";
import { ApiError } from "@/core/api/client";
import { cn } from "@/core/utils/cn";
import { formatDateTime } from "@/core/utils/date";
import { Button } from "@/ui/button";
import { Card, CardBody, CardHeader } from "@/ui/card";
import { Field, Textarea } from "@/ui/field";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import {
  CLIENT_DECLARATION,
  groupsForProcedure,
  procedureLabels,
  RESPONSIBLE_PROFESSIONAL,
} from "../anamnese.questions";
import { useSaveAnamnese, useShareAnamnese, useSignAnamnese } from "../anamnese.api";
import type { AnamneseDto, AnswersInput, SignAnamneseInput } from "../anamnese.dto";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";

/**
 * Preenchimento e assinatura de uma ficha em rascunho.
 *
 * As respostas são um mapa dinâmico por pergunta, então ficam em estado local
 * em vez de `react-hook-form` — casa melhor com um catálogo que pode crescer.
 * A validação de verdade é a do servidor, com o mesmo schema Zod da API.
 */

type AnswerState = Record<string, { value: boolean; detail: string }>;

function initialAnswers(dto: AnamneseDto): AnswerState {
  const state: AnswerState = {};
  for (const group of groupsForProcedure(dto.procedure)) {
    for (const q of group.questions) {
      const saved = dto.answers[q.id];
      state[q.id] = { value: saved?.value ?? false, detail: saved?.detail ?? "" };
    }
  }
  return state;
}

function toAnswersInput(state: AnswerState): AnswersInput {
  const out: AnswersInput = {};
  for (const [id, a] of Object.entries(state)) {
    out[id] = { value: a.value, detail: a.detail.trim() };
  }
  return out;
}

export function AnamneseForm({ anamnese, clientName }: { anamnese: AnamneseDto; clientName: string }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<AnswerState>(() => initialAnswers(anamnese));
  const [observations, setObservations] = useState(anamnese.observations ?? "");
  const [clientEmpty, setClientEmpty] = useState(true);
  const [proEmpty, setProEmpty] = useState(true);

  const clientPad = useRef<SignaturePadHandle>(null);
  const proPad = useRef<SignaturePadHandle>(null);

  const saveMutation = useSaveAnamnese(anamnese.id);
  const signMutation = useSignAnamnese(anamnese.id);
  const shareMutation = useShareAnamnese(anamnese.id);

  // A cliente já preencheu e assinou pelo link? Então falta só a contra-assinatura.
  const clientSigned = Boolean(anamnese.clientSubmittedAt);

  const yesCount = useMemo(() => Object.values(answers).filter((a) => a.value).length, [answers]);

  function setValue(id: string, value: boolean) {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id]!, value } }));
  }
  function setDetail(id: string, detail: string) {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id]!, detail } }));
  }

  async function handleSaveDraft() {
    try {
      await saveMutation.mutateAsync({
        answers: toAnswersInput(answers),
        observations: observations.trim() || null,
      });
      toast.success("Rascunho salvo.");
    } catch {
      toast.error("Não foi possível salvar o rascunho.");
    }
  }

  async function handleShare() {
    try {
      const { whatsappUrl } = await shareMutation.mutateAsync();
      // Abre o WhatsApp com o número e a mensagem já preenchidos.
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Não foi possível gerar o link. Tente novamente.");
    }
  }

  async function handleSign() {
    const professionalSignature = proPad.current?.toDataURL();
    if (!professionalSignature) {
      toast.error("Falta a assinatura da profissional.");
      return;
    }

    // No fluxo presencial a assinatura da cliente vem da tela; quando ela já
    // assinou pelo link, o servidor usa a que está guardada.
    let clientSignature: string | undefined;
    if (!clientSigned) {
      clientSignature = clientPad.current?.toDataURL() ?? undefined;
      if (!clientSignature) {
        toast.error("Falta a assinatura da cliente.");
        return;
      }
    }

    const payload: SignAnamneseInput = {
      answers: toAnswersInput(answers),
      observations: observations.trim() || null,
      professionalSignature,
      ...(clientSignature && { clientSignature }),
    };

    try {
      const signed = await signMutation.mutateAsync(payload);
      toast.success("Anamnese assinada.");
      router.replace(`/clientes/${signed.clientId}/anamnese/${signed.id}`);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Não foi possível assinar. Tente novamente.";
      toast.error(message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho: de qual procedimento é esta ficha. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gold-700">Anamnese</p>
          <h1 className="font-display text-2xl text-ink-900">
            {procedureLabels[anamnese.procedure]}
          </h1>
          <p className="text-sm text-ink-500">{clientName}</p>
        </div>
        {!clientSigned && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleShare}
            loading={shareMutation.isPending}
          >
            <MessageCircle className="size-4" aria-hidden />
            Enviar por WhatsApp
          </Button>
        )}
      </div>

      {/* A cliente preencheu pelo link: falta só a profissional conferir e assinar. */}
      {clientSigned && (
        <div className="flex items-start gap-2.5 rounded-(--radius-card) border border-success/25 bg-success-soft p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <div className="text-sm text-ink-700">
            <p className="font-medium text-success">A cliente preencheu e assinou pelo link.</p>
            <p className="mt-0.5">
              Enviou em{" "}
              {anamnese.clientSubmittedAt
                ? formatDateTime(new Date(anamnese.clientSubmittedAt))
                : "—"}
              . Confira as respostas abaixo e contra-assine para finalizar.
            </p>
          </div>
        </div>
      )}

      {/* ── Questionário ────────────────────────────────────────────────── */}
      {groupsForProcedure(anamnese.procedure).map((group) => (
        <Card key={group.id}>
          <CardHeader title={group.title} />
          <CardBody className="divide-y divide-line">
            {group.questions.map((q) => {
              const answer = answers[q.id]!;
              return (
                <div key={q.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm text-ink-800">{q.label}</span>
                    <YesNo value={answer.value} onChange={(v) => setValue(q.id, v)} />
                  </div>
                  {answer.value && q.wantsDetail && (
                    <input
                      value={answer.detail}
                      onChange={(e) => setDetail(q.id, e.target.value)}
                      placeholder={q.detailLabel ?? "Detalhe"}
                      maxLength={300}
                      className={cn(
                        "w-full rounded-(--radius-field) border border-line-strong bg-surface-muted",
                        "px-3 py-2 text-[16px] text-ink-900 placeholder:text-ink-400 sm:text-sm",
                        "focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-200",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </CardBody>
        </Card>
      ))}

      {/* ── Observações ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Observações" description="Qualquer informação relevante ao atendimento" />
        <CardBody>
          <Field label="Anotações">
            <Textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Sensibilidades, cuidados especiais, combinados…"
            />
          </Field>
        </CardBody>
      </Card>

      {/* ── Assinaturas ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Declaração e assinaturas"
          description="Ao assinar, a ficha vira um documento e não pode mais ser alterada."
        />
        <CardBody className="flex flex-col gap-5">
          <p className="rounded-(--radius-field) bg-surface-muted p-3 text-xs leading-relaxed text-ink-600">
            {CLIENT_DECLARATION}
          </p>

          {clientSigned ? (
            <div className="flex items-center gap-2 rounded-(--radius-field) border border-success/25 bg-success-soft px-3 py-2.5 text-sm text-success">
              <ShieldCheck className="size-4 shrink-0" aria-hidden />
              <span>
                {clientName} assinou pelo link
                {anamnese.clientSubmittedAt
                  ? ` em ${formatDateTime(new Date(anamnese.clientSubmittedAt))}`
                  : ""}
                .
              </span>
            </div>
          ) : (
            <SignaturePad
              ref={clientPad}
              label={`Assinatura da cliente — ${clientName}`}
              onChangeEmpty={setClientEmpty}
            />
          )}

          <div>
            <SignaturePad
              ref={proPad}
              label="Assinatura da profissional"
              onChangeEmpty={setProEmpty}
            />
            <p className="mt-1.5 text-xs text-ink-500">
              {RESPONSIBLE_PROFESSIONAL.name} · {RESPONSIBLE_PROFESSIONAL.documentLabel}{" "}
              {RESPONSIBLE_PROFESSIONAL.document}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* ── Ações ───────────────────────────────────────────────────────── */}
      <div className="sticky bottom-16 z-10 flex flex-col-reverse gap-2 rounded-(--radius-card) border border-line bg-surface/95 p-3 shadow-(--shadow-card) backdrop-blur-md sm:bottom-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-center text-xs text-ink-500 sm:text-left">
          {yesCount === 0
            ? "Nenhum alerta marcado."
            : `${yesCount} ${yesCount === 1 ? "item marcado" : "itens marcados"} para atenção.`}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={handleSaveDraft}
            loading={saveMutation.isPending}
          >
            <Save className="size-4" aria-hidden />
            Salvar rascunho
          </Button>

          <ConfirmDialog
            trigger={
              <Button type="button" disabled={proEmpty || (!clientSigned && clientEmpty)}>
                <Check className="size-4" aria-hidden />
                {clientSigned ? "Conferir e contra-assinar" : "Assinar e finalizar"}
              </Button>
            }
            title="Assinar a anamnese?"
            description="Depois de assinada, a ficha não pode mais ser alterada. Para mudar algo, você criará uma nova anamnese."
            confirmLabel="Assinar"
            onConfirm={handleSign}
          />
        </div>
      </div>
    </div>
  );
}

/** Alternador Não / Sim. "Sim" recebe destaque porque quase sempre é o que pede atenção. */
function YesNo({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-(--radius-field) border border-line-strong">
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={!value}
        className={cn(
          "inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium transition-colors",
          !value ? "bg-ink-900 text-white" : "bg-surface text-ink-500 hover:bg-surface-muted",
        )}
      >
        <X className="size-3.5" aria-hidden />
        Não
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={value}
        className={cn(
          "inline-flex items-center gap-1 border-l border-line-strong px-3 py-1.5 text-sm font-medium transition-colors",
          value ? "bg-rose-600 text-white" : "bg-surface text-ink-500 hover:bg-surface-muted",
        )}
      >
        <Check className="size-3.5" aria-hidden />
        Sim
      </button>
    </div>
  );
}
