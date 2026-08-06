import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { boolean, primaryId, timestamps } from "@/core/db/columns";
import { users } from "@/modules/auth/user.schema";

/**
 * Promoções — campanhas que a profissional cria e reutiliza.
 *
 * A mensagem guarda o texto com o marcador `{nome}`, trocado pelo primeiro nome
 * da cliente na hora de enviar. Não há envio automático: cada envio abre o
 * WhatsApp com a mensagem pronta, uma cliente por vez.
 */
export const promotions = sqliteTable(
  "promotions",
  {
    id: primaryId(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    active: boolean("active", true),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [index("promotions_active_idx").on(table.active)],
);

export type PromotionRow = typeof promotions.$inferSelect;
export type NewPromotionRow = typeof promotions.$inferInsert;
