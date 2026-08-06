import { z } from "zod";
import { formatPhone } from "@/core/utils/phone";
import type { PromotionRow } from "./promotion.schema";

/**
 * Contrato do marketing.
 *
 * Uma cliente aqui é enxuta: só o que a tela precisa para listar e montar o
 * link de WhatsApp — nome, telefone e a data que a qualifica (última visita ou
 * dia do aniversário). Nada de dado sensível.
 */

// ── Promoções ─────────────────────────────────────────────────────────────────

export const createPromotionSchema = z.object({
  title: z.string().trim().min(2, "Dê um título à promoção.").max(80, "Título muito longo."),
  message: z
    .string()
    .trim()
    .min(4, "Escreva a mensagem da promoção.")
    .max(1000, "Mensagem muito longa."),
  active: z.boolean().default(true),
});
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;

// Escrito à mão (sem `.partial()`) para um PATCH não reaplicar o default de `active`.
export const updatePromotionSchema = z.object({
  title: createPromotionSchema.shape.title.optional(),
  message: createPromotionSchema.shape.message.optional(),
  active: z.boolean().optional(),
});
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;

export interface PromotionDto {
  id: string;
  title: string;
  message: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toPromotionDto(row: PromotionRow): PromotionDto {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Clientes por grupo ────────────────────────────────────────────────────────

/** Limite padrão de dias sem vir que define uma cliente "sumida". */
export const DEFAULT_WINBACK_DAYS = 60;

export interface MarketingClient {
  id: string;
  name: string;
  phone: string;
  phoneFormatted: string;
  /** ISO da última visita, ou null se nunca veio. */
  lastVisitAt: string | null;
  /** ISO do cadastro — usado para decidir "sumida" de quem nunca veio. */
  createdAt: string;
  /** Dia do mês do aniversário — presente no grupo de aniversariantes. */
  birthdayDay: number | null;
  isBirthdayToday: boolean;
}

export interface MarketingData {
  /** Aniversariantes do mês. */
  birthdays: MarketingClient[];
  /** Todas as clientes ativas — a base de onde o cliente deriva "sumidas". */
  all: MarketingClient[];
  promotions: PromotionDto[];
  /** "Agora" do servidor, para o cliente derivar as sumidas sem chamar Date.now no render. */
  nowMs: number;
}

export function marketingClient(
  client: { id: string; name: string; phone: string; createdAt: Date },
  extra: { lastVisitAt?: Date | null; birthdayDay?: number | null; isBirthdayToday?: boolean } = {},
): MarketingClient {
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    phoneFormatted: formatPhone(client.phone),
    lastVisitAt: extra.lastVisitAt?.toISOString() ?? null,
    createdAt: client.createdAt.toISOString(),
    birthdayDay: extra.birthdayDay ?? null,
    isBirthdayToday: extra.isBirthdayToday ?? false,
  };
}
