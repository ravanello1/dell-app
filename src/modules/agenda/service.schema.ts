import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { boolean, primaryId, timestamps } from "@/core/db/columns";

export const serviceCategories = [
  "CILIOS",
  "SOBRANCELHA",
  "LABIOS",
  "UNHAS",
  "ESTETICA",
  "OUTRO",
] as const;
export type ServiceCategory = (typeof serviceCategories)[number];

export const serviceCategoryLabels: Record<ServiceCategory, string> = {
  CILIOS: "Cílios",
  SOBRANCELHA: "Sobrancelha",
  LABIOS: "Lábios",
  UNHAS: "Unhas",
  ESTETICA: "Estética",
  OUTRO: "Outro",
};

/** Procedimentos oferecidos pelo studio. A duração define o tamanho do bloco
 *  na agenda; o preço é copiado para o agendamento no momento da marcação. */
export const services = sqliteTable(
  "services",
  {
    id: primaryId(),
    name: text("name").notNull(),
    category: text("category", { enum: serviceCategories }).notNull().default("CILIOS"),
    durationMin: integer("duration_min").notNull(),
    /** Sempre em centavos inteiros. Dinheiro em ponto flutuante acumula erro. */
    priceCents: integer("price_cents").notNull().default(0),
    color: text("color").notNull().default("#C2557E"),
    description: text("description"),
    active: boolean("active", true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [index("services_active_idx").on(table.active)],
);

export type ServiceRow = typeof services.$inferSelect;
export type NewServiceRow = typeof services.$inferInsert;
