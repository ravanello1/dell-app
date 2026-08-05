import { z } from "zod";
import {
  booleanFlag,
  optionalDateOnly,
  optionalEmail,
  optionalEnum,
  optionalText,
} from "@/core/api/dto";
import { formatPhone, isValidBrazilianPhone, normalizePhone } from "@/core/utils/phone";
import { ageFromBirthDate } from "@/core/utils/date";
import { clientSources, type ClientRow } from "./client.schema";

/**
 * Contrato de dados do módulo de clientes.
 *
 * O mesmo schema valida o corpo da requisição na API e o formulário na tela —
 * a regra de "telefone precisa de DDD" existe uma vez só, e não há como as duas
 * pontas discordarem.
 */

const phoneSchema = z
  .string()
  .min(1, "Informe o telefone.")
  .transform(normalizePhone)
  .refine(isValidBrazilianPhone, "Telefone inválido. Informe DDD + número.");

/** Instagram guardado sem o "@" e sem URL, só o usuário. */
const instagramSchema = optionalText(60).transform((value) =>
  value ? value.replace(/^@+/, "").replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "").replace(/\/+$/, "") : null,
);

export const createClientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome da cliente.")
    .max(120, "Nome muito longo."),
  phone: phoneSchema,
  email: optionalEmail,
  birthDate: optionalDateOnly,
  instagram: instagramSchema,

  cep: optionalText(9).transform((value) => (value ? value.replace(/\D/g, "") || null : null)),
  street: optionalText(160),
  streetNumber: optionalText(20),
  complement: optionalText(80),
  district: optionalText(80),
  city: optionalText(80),
  state: optionalText(2),

  source: optionalEnum(clientSources),
  notes: optionalText(2000),
  healthNotes: optionalText(2000),

  /** Marcado no formulário: a cliente autorizou o tratamento dos dados. */
  lgpdConsent: z.boolean().default(false),
});

export type CreateClientInput = z.input<typeof createClientSchema>;

/**
 * Na edição todo campo é opcional — só o que veio é alterado.
 *
 * `lgpdConsent` é redeclarado sem o `.default(false)`: com o padrão, um PATCH
 * que só corrigisse o nome revogaria o consentimento da cliente sem ninguém
 * pedir. Aqui, ausente significa "não mexa".
 */
export const updateClientSchema = createClientSchema.partial().extend({
  lgpdConsent: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const clientQuerySchema = z.object({
  /** Busca por nome ou telefone. */
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  includeInactive: booleanFlag(false),
  sort: z.enum(["name", "recent"]).default("name"),
});

export type ClientQuery = z.infer<typeof clientQuerySchema>;

/**
 * Como uma cliente sai da API.
 *
 * `healthNotes` é opcional de propósito: a recepção não recebe esse campo, e
 * quem consome precisa lidar com a ausência dele em vez de assumir que existe.
 */
export interface ClientDto {
  id: string;
  name: string;
  phone: string;
  phoneFormatted: string;
  email: string | null;
  birthDate: string | null;
  age: number | null;
  instagram: string | null;
  cep: string | null;
  street: string | null;
  streetNumber: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  source: (typeof clientSources)[number] | null;
  notes: string | null;
  healthNotes?: string | null;
  hasLgpdConsent: boolean;
  lgpdConsentAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ClientListItem = Pick<
  ClientDto,
  "id" | "name" | "phone" | "phoneFormatted" | "instagram" | "active" | "createdAt"
> & { birthDate: string | null };

/** Converte a linha do banco para o formato exposto pela API. */
export function toClientDto(row: ClientRow, options: { includeHealth: boolean }): ClientDto {
  const dto: ClientDto = {
    id: row.id,
    name: row.name,
    phone: row.phone,
    phoneFormatted: formatPhone(row.phone),
    email: row.email,
    birthDate: row.birthDate,
    age: row.birthDate ? ageFromBirthDate(row.birthDate) : null,
    instagram: row.instagram,
    cep: row.cep,
    street: row.street,
    streetNumber: row.streetNumber,
    complement: row.complement,
    district: row.district,
    city: row.city,
    state: row.state,
    source: row.source,
    notes: row.notes,
    hasLgpdConsent: row.lgpdConsentAt !== null,
    lgpdConsentAt: row.lgpdConsentAt?.toISOString() ?? null,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  if (options.includeHealth) dto.healthNotes = row.healthNotes;
  return dto;
}
