import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { boolean, primaryId, timestamps } from "@/core/db/columns";

/**
 * Papéis do studio, do mais permissivo para o mais restrito.
 * OWNER     — Dell: acesso total, incluindo custos, usuários e exclusão de dados
 * PRO       — profissional: agenda própria e ficha de clientes, sem custos
 * RECEPTION — recepção: agenda de todos e cadastro de clientes, sem custos
 */
export const userRoles = ["OWNER", "PRO", "RECEPTION"] as const;
export type UserRole = (typeof userRoles)[number];

export const userRoleLabels: Record<UserRole, string> = {
  OWNER: "Proprietária",
  PRO: "Profissional",
  RECEPTION: "Recepção",
};

export const users = sqliteTable(
  "users",
  {
    id: primaryId(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: userRoles }).notNull().default("RECEPTION"),
    active: boolean("active", true),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
