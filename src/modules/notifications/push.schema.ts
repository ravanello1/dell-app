import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { primaryId } from "@/core/db/columns";
import { users } from "@/modules/auth/user.schema";

/**
 * Inscrições de notificação push (Web Push).
 *
 * Cada aparelho onde a profissional ativa as notificações vira uma linha: o
 * `endpoint` é a "caixa postal" que o navegador dela deu, e as chaves
 * (`p256dh`, `auth`) cifram a mensagem de ponta a ponta até o aparelho. Um
 * usuário pode ter vários aparelhos, por isso não é um-para-um.
 */
export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: primaryId(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    lastNotifiedAt: integer("last_notified_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    // O endpoint identifica o aparelho: um só registro por caixa postal.
    uniqueIndex("push_endpoint_unique").on(table.endpoint),
    index("push_user_idx").on(table.userId),
  ],
);

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscriptionRow = typeof pushSubscriptions.$inferInsert;
