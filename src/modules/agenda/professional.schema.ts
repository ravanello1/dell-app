import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { boolean, primaryId, timestamps } from "@/core/db/columns";
import { users } from "@/modules/auth/user.schema";

/**
 * Quem atende. Propositalmente separado de `users`: dá para cadastrar uma
 * profissional na agenda antes (ou sem) criar um login para ela, e o vínculo
 * pode ser feito depois preenchendo `userId`.
 */
export const professionals = sqliteTable(
  "professionals",
  {
    id: primaryId(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    /** Cor da coluna e dos cards dessa profissional no calendário (hex). */
    color: text("color").notNull().default("#C9A227"),
    phone: text("phone"),
    active: boolean("active", true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [index("professionals_active_idx").on(table.active)],
);

export type ProfessionalRow = typeof professionals.$inferSelect;
export type NewProfessionalRow = typeof professionals.$inferInsert;
