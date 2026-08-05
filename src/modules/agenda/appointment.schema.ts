import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryId, timestamps } from "@/core/db/columns";
import { users } from "@/modules/auth/user.schema";
import { clients } from "@/modules/clients/client.schema";
import { professionals } from "./professional.schema";
import { services } from "./service.schema";

export const appointmentStatuses = [
  "SCHEDULED",
  "CONFIRMED",
  "IN_PROGRESS",
  "DONE",
  "NO_SHOW",
  "CANCELED",
] as const;
export type AppointmentStatus = (typeof appointmentStatuses)[number];

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "Em atendimento",
  DONE: "Concluído",
  NO_SHOW: "Não compareceu",
  CANCELED: "Cancelado",
};

/** Status que ainda ocupam espaço na agenda — usados na checagem de conflito. */
export const blockingStatuses = [
  "SCHEDULED",
  "CONFIRMED",
  "IN_PROGRESS",
  "DONE",
] as const satisfies readonly AppointmentStatus[];

export const appointments = sqliteTable(
  "appointments",
  {
    id: primaryId(),
    /** Cascade: apagar a cliente em definitivo (LGPD) leva o histórico junto. */
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    /** Restrict: serviço em uso não se apaga, se desativa. */
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    professionalId: text("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "restrict" }),

    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: appointmentStatuses }).notNull().default("SCHEDULED"),

    /** Preço congelado na marcação: mudar a tabela de preços não reescreve o passado. */
    priceCents: integer("price_cents").notNull().default(0),
    notes: text("notes"),

    /** Gancho para o lembrete de WhatsApp: marca quando a mensagem saiu. */
    reminderSentAt: integer("reminder_sent_at", { mode: "timestamp_ms" }),

    canceledAt: integer("canceled_at", { mode: "timestamp_ms" }),
    cancelReason: text("cancel_reason"),

    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    // Índice que sustenta a checagem de conflito e a montagem do dia.
    index("appointments_professional_start_idx").on(table.professionalId, table.startAt),
    index("appointments_client_start_idx").on(table.clientId, table.startAt),
    index("appointments_start_idx").on(table.startAt),
  ],
);

export type AppointmentRow = typeof appointments.$inferSelect;
export type NewAppointmentRow = typeof appointments.$inferInsert;
