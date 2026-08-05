import { z } from "zod";
import { instant, optionalEnum, optionalText } from "@/core/api/dto";
import { appointmentStatuses } from "./appointment.schema";
import { serviceCategories } from "./service.schema";

/** Contrato de dados da agenda: procedimentos, profissionais e agendamentos. */

// ── Procedimentos ─────────────────────────────────────────────────────────────

export const createServiceSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do procedimento.").max(80),
  category: z.enum(serviceCategories).default("CILIOS"),
  durationMin: z.coerce
    .number()
    .int("Use minutos inteiros.")
    .min(5, "Duração mínima de 5 minutos.")
    .max(600, "Duração máxima de 10 horas."),
  priceCents: z.coerce.number().int().min(0, "O preço não pode ser negativo."),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #RRGGBB.")
    .default("#be3f6c"),
  description: optionalText(300),
  active: z.boolean().default(true),
});

/**
 * Atualização escrita à mão, e não com `.partial()` do schema de criação.
 *
 * `.partial()` deixa a chave opcional mas NÃO remove o `.default()` — então um
 * PATCH que só renomeia o procedimento voltaria a cor, a categoria e o "ativo"
 * para os valores padrão, apagando escolhas feitas antes.
 */
export const updateServiceSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do procedimento.").max(80).optional(),
  category: z.enum(serviceCategories).optional(),
  durationMin: z.coerce.number().int().min(5).max(600).optional(),
  priceCents: z.coerce.number().int().min(0).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #RRGGBB.")
    .optional(),
  description: optionalText(300),
  active: z.boolean().optional(),
});

export interface ServiceDto {
  id: string;
  name: string;
  category: (typeof serviceCategories)[number];
  durationMin: number;
  priceCents: number;
  color: string;
  description: string | null;
  active: boolean;
}

// ── Profissionais ─────────────────────────────────────────────────────────────

export const createProfessionalSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(80),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #RRGGBB.")
    .default("#c9a227"),
  phone: optionalText(20),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

/** Mesmo cuidado do schema de procedimento: sem defaults reaplicados. */
export const updateProfessionalSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(80).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #RRGGBB.")
    .optional(),
  phone: optionalText(20),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export interface ProfessionalDto {
  id: string;
  name: string;
  color: string;
  phone: string | null;
  active: boolean;
  sortOrder: number;
}

// ── Agendamentos ──────────────────────────────────────────────────────────────

export const createAppointmentSchema = z.object({
  clientId: z.string().min(1, "Escolha a cliente."),
  serviceId: z.string().min(1, "Escolha o procedimento."),
  professionalId: z.string().min(1, "Escolha a profissional."),
  startAt: instant,
  /** Ausente = calculado a partir da duração do procedimento. */
  endAt: instant.optional(),
  /** Ausente = copiado do preço do procedimento. */
  priceCents: z.coerce.number().int().min(0).optional(),
  status: z.enum(appointmentStatuses).default("SCHEDULED"),
  notes: optionalText(1000),
});

export const updateAppointmentSchema = z.object({
  clientId: z.string().min(1).optional(),
  serviceId: z.string().min(1).optional(),
  professionalId: z.string().min(1).optional(),
  startAt: instant.optional(),
  endAt: instant.optional(),
  priceCents: z.coerce.number().int().min(0).optional(),
  status: optionalEnum(appointmentStatuses),
  notes: optionalText(1000),
  cancelReason: optionalText(200),
});

/** Faixa de tempo consultada pelo calendário. */
export const agendaRangeSchema = z.object({
  from: instant,
  to: instant,
  professionalId: z.string().optional(),
  /** Cancelados ficam fora por padrão — poluem a grade. */
  includeCanceled: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type AgendaRange = z.infer<typeof agendaRangeSchema>;

/**
 * Agendamento como sai da API: já traz cliente, procedimento e profissional
 * embutidos. O calendário renderiza dezenas de cards de uma vez — buscar cada
 * relação separadamente seria o clássico problema de N+1 na tela.
 */
export interface AppointmentDto {
  id: string;
  startAt: string;
  endAt: string;
  status: (typeof appointmentStatuses)[number];
  priceCents: number;
  notes: string | null;
  reminderSentAt: string | null;
  cancelReason: string | null;
  client: {
    id: string;
    name: string;
    phone: string;
    phoneFormatted: string;
  };
  service: {
    id: string;
    name: string;
    durationMin: number;
    color: string;
    category: (typeof serviceCategories)[number];
  };
  professional: {
    id: string;
    name: string;
    color: string;
  };
}
