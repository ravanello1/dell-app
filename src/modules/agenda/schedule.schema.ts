import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { boolean, primaryId, timestamps } from "@/core/db/columns";
import { professionals } from "./professional.schema";

/**
 * Disponibilidade do studio.
 *
 * Estas duas tabelas existem desde a primeira migração, sem tela ainda: são a
 * base do agendamento online público. Criá-las agora custa quase nada e evita
 * uma migração destrutiva depois, quando já houver dados reais.
 */

/** Horário de funcionamento por dia da semana. `professionalId` nulo = studio todo. */
export const businessHours = sqliteTable(
  "business_hours",
  {
    id: primaryId(),
    professionalId: text("professional_id").references(() => professionals.id, {
      onDelete: "cascade",
    }),
    /** 0 = domingo … 6 = sábado, seguindo `Date#getDay`. */
    weekday: integer("weekday").notNull(),
    /** Minutos desde a meia-noite: 8h = 480, 18h30 = 1110. */
    openMinute: integer("open_minute").notNull(),
    closeMinute: integer("close_minute").notNull(),
    active: boolean("active", true),
    ...timestamps,
  },
  (table) => [index("business_hours_weekday_idx").on(table.weekday)],
);

/** Bloqueios pontuais: almoço, folga, feriado, curso, manutenção. */
export const scheduleBlocks = sqliteTable(
  "schedule_blocks",
  {
    id: primaryId(),
    professionalId: text("professional_id").references(() => professionals.id, {
      onDelete: "cascade",
    }),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    reason: text("reason"),
    ...timestamps,
  },
  (table) => [index("schedule_blocks_start_idx").on(table.startAt)],
);

export type BusinessHourRow = typeof businessHours.$inferSelect;
export type ScheduleBlockRow = typeof scheduleBlocks.$inferSelect;
