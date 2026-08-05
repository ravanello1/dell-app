import { z } from "zod";
import { formatPhone } from "@/core/utils/phone";
import {
  anamneseQuestionById,
  anamneseQuestionIds,
  CLIENT_DECLARATION,
  RESPONSIBLE_PROFESSIONAL,
} from "./anamnese.questions";
import {
  anamneseProcedures,
  type AnamneseProcedure,
  type AnamneseRow,
  type AnamneseStatus,
} from "./anamnese.schema";

/**
 * Contrato de dados da anamnese.
 *
 * O mesmo schema valida a API e o formulário. As respostas são um objeto
 * indexado pelo id da pergunta; a validação garante que só ids conhecidos
 * entrem e que "detalhe" seja texto curto — nada de blob arbitrário no banco.
 */

/** Resposta de uma pergunta: marcada ou não, com detalhe opcional. */
const answerSchema = z.object({
  value: z.boolean(),
  detail: z.string().trim().max(300, "Detalhe muito longo.").optional().default(""),
});

/**
 * Mapa de respostas. Chaves precisam ser perguntas conhecidas — uma chave
 * desconhecida é recusada em vez de silenciosamente guardada, senão o catálogo
 * e o banco divergiriam sem ninguém perceber.
 */
export const answersSchema = z
  .record(z.string(), answerSchema)
  .refine(
    (answers) => Object.keys(answers).every((id) => anamneseQuestionById.has(id)),
    "Resposta para uma pergunta desconhecida.",
  );

export type AnswersInput = z.infer<typeof answersSchema>;

/** Assinatura desenhada: PNG em data URI, com teto de tamanho. */
const signatureSchema = z
  .string()
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "Assinatura inválida.")
  // ~700 KB de base64 — folga larga para uma assinatura, teto contra abuso.
  .max(700_000, "Assinatura muito pesada.");

/** Abertura de ficha: escolhe o procedimento. */
export const createAnamneseSchema = z.object({
  procedure: z.enum(anamneseProcedures),
});
export type CreateAnamneseInput = z.infer<typeof createAnamneseSchema>;

/** Rascunho: salva respostas e observações enquanto não está assinada. */
export const saveAnamneseSchema = z.object({
  answers: answersSchema.optional(),
  observations: z.string().trim().max(2000, "Observações muito longas.").nullable().optional(),
});
export type SaveAnamneseInput = z.infer<typeof saveAnamneseSchema>;

/**
 * Assinatura da profissional (no studio). A assinatura da cliente é opcional
 * aqui: quando ela já preencheu e assinou pelo link, a profissional só
 * contra-assina, e o service usa a assinatura da cliente já guardada. O service
 * garante que uma ficha nunca vire documento sem as duas.
 */
export const signAnamneseSchema = z.object({
  professionalSignature: signatureSchema,
  /** Presente no fluxo presencial; ausente quando a cliente já assinou pelo link. */
  clientSignature: signatureSchema.optional(),
  /** Opcional: quando outra profissional assina no lugar da responsável padrão. */
  professionalId: z.string().min(1).optional(),
  /** Últimas respostas/observações da tela, salvas junto com a assinatura. */
  answers: answersSchema.optional(),
  observations: z.string().trim().max(2000).nullable().optional(),
});
export type SignAnamneseInput = z.infer<typeof signAnamneseSchema>;

/** Envio da cliente pelo link público: respostas + a assinatura dela. */
export const submitPublicSchema = z.object({
  answers: answersSchema,
  observations: z.string().trim().max(2000, "Observações muito longas.").nullable().optional(),
  clientSignature: signatureSchema,
});
export type SubmitPublicInput = z.infer<typeof submitPublicSchema>;

// ── Saída ────────────────────────────────────────────────────────────────────

export interface AnamneseSignatureBlock {
  client: { name: string; phone: string; birthDate: string | null };
  professional: { name: string; document: string; documentLabel: string; title: string };
  declaration: string;
}

export interface AnamneseDto {
  id: string;
  clientId: string;
  procedure: AnamneseProcedure;
  status: AnamneseStatus;
  answers: AnswersInput;
  observations: string | null;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Quando a cliente preencheu e assinou pelo link — falta a contra-assinatura. */
  clientSubmittedAt: string | null;
  /** Snapshot congelado na assinatura — presente só em ficha assinada. */
  snapshot: AnamneseSignatureBlock | null;
  /** Imagens das assinaturas — só quando `withSignatures` é pedido (view/impressão). */
  clientSignature?: string | null;
  professionalSignature?: string | null;
}

export type AnamneseListItem = Pick<
  AnamneseDto,
  "id" | "clientId" | "procedure" | "status" | "signedAt" | "clientSubmittedAt" | "createdAt" | "updatedAt"
> & { answeredYesCount: number };

/** Quantas perguntas foram marcadas como "sim" — resumo rápido para a lista. */
function countYes(answers: AnswersInput): number {
  return Object.values(answers).filter((a) => a.value).length;
}

function parseAnswers(raw: unknown): AnswersInput {
  const parsed = answersSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

export function toAnamneseListItem(row: AnamneseRow): AnamneseListItem {
  const answers = parseAnswers(row.answers);
  return {
    id: row.id,
    clientId: row.clientId,
    procedure: row.procedure,
    status: row.status,
    signedAt: row.signedAt?.toISOString() ?? null,
    clientSubmittedAt: row.clientSubmittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    answeredYesCount: countYes(answers),
  };
}

export function toAnamneseDto(
  row: AnamneseRow,
  options: { withSignatures?: boolean } = {},
): AnamneseDto {
  const dto: AnamneseDto = {
    id: row.id,
    clientId: row.clientId,
    procedure: row.procedure,
    status: row.status,
    answers: parseAnswers(row.answers),
    observations: row.observations,
    signedAt: row.signedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    clientSubmittedAt: row.clientSubmittedAt?.toISOString() ?? null,
    snapshot: (row.signedSnapshot as AnamneseSignatureBlock | null) ?? null,
  };

  if (options.withSignatures) {
    dto.clientSignature = row.clientSignature;
    dto.professionalSignature = row.professionalSignature;
  }

  return dto;
}

// ── Link público ──────────────────────────────────────────────────────────────

/** Situação do link quando a cliente o abre. */
export type PublicAnamneseState = "FILLABLE" | "SUBMITTED" | "SIGNED" | "EXPIRED";

/**
 * O que a página pública devolve. Enxuto de propósito: só o primeiro nome da
 * cliente (para ela confirmar que é a ficha dela), o procedimento e as
 * respostas já preenchidas. Nada de telefone, endereço, outras fichas ou
 * qualquer dado que exponha demais caso o link vaze.
 */
export interface PublicAnamneseDto {
  state: PublicAnamneseState;
  procedure: AnamneseProcedure;
  clientFirstName: string;
  answers: AnswersInput;
  observations: string | null;
}

export function toPublicAnamneseDto(
  row: AnamneseRow,
  state: PublicAnamneseState,
  clientFirstName: string,
): PublicAnamneseDto {
  return {
    state,
    procedure: row.procedure,
    clientFirstName,
    answers: parseAnswers(row.answers),
    observations: row.observations,
  };
}

/** Monta o bloco que será congelado ao assinar, a partir dos dados atuais. */
export function buildSignatureSnapshot(client: {
  name: string;
  phone: string;
  birthDate: string | null;
}): AnamneseSignatureBlock {
  return {
    client: {
      name: client.name,
      phone: formatPhone(client.phone),
      birthDate: client.birthDate,
    },
    professional: {
      name: RESPONSIBLE_PROFESSIONAL.name,
      document: RESPONSIBLE_PROFESSIONAL.document,
      documentLabel: RESPONSIBLE_PROFESSIONAL.documentLabel,
      title: RESPONSIBLE_PROFESSIONAL.title,
    },
    declaration: CLIENT_DECLARATION,
  };
}

export { anamneseQuestionIds };
