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
 * Assinatura: exige as duas assinaturas juntas. Assinar é o ato que torna a
 * ficha um documento — não faz sentido pela metade.
 */
export const signAnamneseSchema = z.object({
  clientSignature: signatureSchema,
  professionalSignature: signatureSchema,
  /** Opcional: quando outra profissional assina no lugar da responsável padrão. */
  professionalId: z.string().min(1).optional(),
  /** Últimas respostas/observações da tela, salvas junto com a assinatura. */
  answers: answersSchema.optional(),
  observations: z.string().trim().max(2000).nullable().optional(),
});
export type SignAnamneseInput = z.infer<typeof signAnamneseSchema>;

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
  /** Snapshot congelado na assinatura — presente só em ficha assinada. */
  snapshot: AnamneseSignatureBlock | null;
  /** Imagens das assinaturas — só quando `withSignatures` é pedido (view/impressão). */
  clientSignature?: string | null;
  professionalSignature?: string | null;
}

export type AnamneseListItem = Pick<
  AnamneseDto,
  "id" | "clientId" | "procedure" | "status" | "signedAt" | "createdAt" | "updatedAt"
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
    snapshot: (row.signedSnapshot as AnamneseSignatureBlock | null) ?? null,
  };

  if (options.withSignatures) {
    dto.clientSignature = row.clientSignature;
    dto.professionalSignature = row.professionalSignature;
  }

  return dto;
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
