import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { boolean, primaryId, timestamps } from "@/core/db/columns";
import { users } from "@/modules/auth/user.schema";

/** Como a cliente conheceu o studio — alimenta decisão de marketing. */
export const clientSources = [
  "INSTAGRAM",
  "INDICACAO",
  "GOOGLE",
  "PASSANDO_EM_FRENTE",
  "WHATSAPP",
  "OUTRO",
] as const;
export type ClientSource = (typeof clientSources)[number];

export const clientSourceLabels: Record<ClientSource, string> = {
  INSTAGRAM: "Instagram",
  INDICACAO: "Indicação",
  GOOGLE: "Google",
  PASSANDO_EM_FRENTE: "Passando em frente",
  WHATSAPP: "WhatsApp",
  OUTRO: "Outro",
};

export const clients = sqliteTable(
  "clients",
  {
    id: primaryId(),
    name: text("name").notNull(),
    /** Somente dígitos, com DDD: "41991234567". A máscara vive na UI. */
    phone: text("phone").notNull(),
    email: text("email"),
    /** "YYYY-MM-DD" em texto, não timestamp: aniversário não tem fuso horário
     *  e guardar como data absoluta evitaria o clássico erro de um dia a menos. */
    birthDate: text("birth_date"),
    instagram: text("instagram"),

    cep: text("cep"),
    street: text("street"),
    streetNumber: text("street_number"),
    complement: text("complement"),
    district: text("district"),
    city: text("city").default("Curitiba"),
    state: text("state").default("PR"),

    source: text("source", { enum: clientSources }),
    notes: text("notes"),
    /** Alergias, sensibilidades, histórico relevante ao procedimento.
     *  É dado sensível sob a LGPD — só OWNER e PRO enxergam. */
    healthNotes: text("health_notes"),

    /** Momento em que a cliente consentiu com o tratamento dos dados. */
    lgpdConsentAt: integer("lgpd_consent_at", { mode: "timestamp_ms" }),

    active: boolean("active", true),
    /** Soft delete: some das listas mas preserva o histórico de atendimentos.
     *  A exclusão definitiva (direito ao esquecimento) é uma ação separada. */
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),

    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("clients_name_idx").on(table.name),
    index("clients_phone_idx").on(table.phone),
    index("clients_deleted_at_idx").on(table.deletedAt),
  ],
);

export type ClientRow = typeof clients.$inferSelect;
export type NewClientRow = typeof clients.$inferInsert;
