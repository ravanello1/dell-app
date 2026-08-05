"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ShieldCheck, X } from "lucide-react";
import { cn } from "@/core/utils/cn";
import { Button } from "@/ui/button";
import { Card, CardBody, CardHeader } from "@/ui/card";
import { Field, Textarea } from "@/ui/field";
import { CLIENT_DECLARATION, groupsForProcedure, procedureLabels } from "../anamnese.questions";
import { submitPublicAnamneseAction } from "../anamnese.public.actions";
import type { AnswersInput, PublicAnamneseDto } from "../anamnese.dto";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";

/**
 * Formulário que a cliente preenche pelo link, sem login. Igual em espírito ao
 * formulário interno, mas enxuto: só as perguntas, uma assinatura (a dela) e um
 * botão de enviar. A profissional contra-assina depois, no studio.
 */

type AnswerState = Record<string, { value: boolean; detail: string }>;

function initialAnswers(data: PublicAnamneseDto): AnswerState {
  const state: AnswerState = {};
  for (const group of groupsForProcedure(data.procedure)) {
    for (const q of group.questions) {
      const saved = data.answers[q.id];
      state[q.id] = { value: saved?.value ?? false, detail: saved?.detail ?? "" };
    }
  }
  return state;
}

export function PublicAnamneseForm({ token, data }: { token: string; data: PublicAnamneseDto }) {
  const [answers, setAnswers] = useState<AnswerState>(() => initialAnswers(data));
  const [observations, setObservations] = useState(data.observations ?? "");
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const pad = useRef<SignaturePadHandle>(null);

  const yesCount = useMemo(() => Object.values(answers).filter((a) => a.value).length, [answers]);

  function setValue(id: string, value: boolean) {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id]!, value } }));
  }
  function setDetail(id: string, detail: string) {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id]!, detail } }));
  }

  async function handleSubmit() {
    const signature = pad.current?.toDataURL();
    if (!signature) {
      toast.error("Falta a sua assinatura.");
      return;
    }

    const payload: { answers: AnswersInput; observations: string | null; clientSignature: string } = {
      answers: Object.fromEntries(
        Object.entries(answers).map(([id, a]) => [id, { value: a.value, detail: a.detail.trim() }]),
      ),
      observations: observations.trim() || null,
      clientSignature: signature,
    };

    setSubmitting(true);
    try {
      const result = await submitPublicAnamneseAction(token, payload);
      if (result.ok) {
        setDone(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Não foi possível enviar agora. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-(--radius-card) border border-line bg-surface p-6 text-center shadow-(--shadow-card)">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full border border-success/25 bg-success-soft text-success">
          <ShieldCheck className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-lg font-medium text-ink-900">Ficha enviada, {data.clientFirstName}!</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
          Recebemos suas respostas. Você vai confirmar e assinar junto com a profissional no dia do
          atendimento. Obrigada! 💛
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-(--radius-card) border border-gold-200 bg-gold-50/50 p-4 text-center">
        <p className="text-sm text-ink-700">
          Olá, <span className="font-medium">{data.clientFirstName}</span>! Responda com atenção —
          é o que mantém o seu atendimento de{" "}
          <span className="font-medium">{procedureLabels[data.procedure]}</span> seguro.
        </p>
      </div>

      {groupsForProcedure(data.procedure).map((group) => (
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
                        "px-3 py-2 text-[16px] text-ink-900 placeholder:text-ink-400",
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

      <Card>
        <CardHeader title="Observações" description="Algo mais que a profissional deva saber?" />
        <CardBody>
          <Field label="Anotações">
            <Textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Opcional"
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Declaração e assinatura" />
        <CardBody className="flex flex-col gap-4">
          <p className="rounded-(--radius-field) bg-surface-muted p-3 text-xs leading-relaxed text-ink-600">
            {CLIENT_DECLARATION}
          </p>
          <SignaturePad ref={pad} label="Sua assinatura" onChangeEmpty={setSignatureEmpty} />
        </CardBody>
      </Card>

      <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-(--radius-card) border border-line bg-surface/95 p-3 shadow-(--shadow-card) backdrop-blur-md">
        <p className="text-xs text-ink-500">
          {yesCount === 0 ? "Nada marcado como sim." : `${yesCount} marcado(s) como sim.`}
        </p>
        <Button onClick={handleSubmit} disabled={signatureEmpty} loading={submitting}>
          <Check className="size-4" aria-hidden />
          Enviar ficha
        </Button>
      </div>
    </div>
  );
}

/** Alternador Não / Sim, igual ao do formulário interno. */
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
