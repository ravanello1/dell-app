import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryId, timestamps } from "@/core/db/columns";
import { users } from "@/modules/auth/user.schema";
import { clients } from "@/modules/clients/client.schema";
import { appointments } from "@/modules/agenda/appointment.schema";
import { products } from "@/modules/inventory/product.schema";

/**
 * Tabelas dos módulos que vêm a seguir — Financeiro e Mapping de cílios.
 *
 * Elas nascem junto com a primeira migração de propósito. Uma chave estrangeira
 * adicionada depois, num banco SQLite que já tem histórico real, obriga a
 * recriar a tabela inteira; criá-las vazias agora custa alguns kilobytes e
 * deixa o caminho livre. Nenhuma tela lê estas tabelas ainda.
 */

// ── Financeiro ────────────────────────────────────────────────────────────────

export const paymentMethods = ["PIX", "CREDIT", "DEBIT", "CASH", "TRANSFER", "OTHER"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  PIX: "Pix",
  CREDIT: "Cartão de crédito",
  DEBIT: "Cartão de débito",
  CASH: "Dinheiro",
  TRANSFER: "Transferência",
  OTHER: "Outro",
};

export const payments = sqliteTable(
  "payments",
  {
    id: primaryId(),
    appointmentId: text("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    method: text("method", { enum: paymentMethods }).notNull().default("PIX"),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }).notNull(),
    notes: text("notes"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [index("payments_paid_at_idx").on(table.paidAt)],
);

export const expenseCategories = [
  "PRODUTO",
  "ALUGUEL",
  "MARKETING",
  "IMPOSTO",
  "EQUIPAMENTO",
  "CURSO",
  "OUTRO",
] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];

export const expenses = sqliteTable(
  "expenses",
  {
    id: primaryId(),
    description: text("description").notNull(),
    category: text("category", { enum: expenseCategories }).notNull().default("OUTRO"),
    amountCents: integer("amount_cents").notNull(),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }).notNull(),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [index("expenses_paid_at_idx").on(table.paidAt)],
);

// ── Mapping de cílios e registro visual ───────────────────────────────────────

export const photoKinds = ["BEFORE", "AFTER", "MAPPING", "OTHER"] as const;
export type PhotoKind = (typeof photoKinds)[number];

export const clientPhotos = sqliteTable(
  "client_photos",
  {
    id: primaryId(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    appointmentId: text("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull(),
    kind: text("kind", { enum: photoKinds }).notNull().default("OTHER"),
    takenAt: integer("taken_at", { mode: "timestamp_ms" }).notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [index("client_photos_client_idx").on(table.clientId)],
);

export const lashMaps = sqliteTable(
  "lash_maps",
  {
    id: primaryId(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    appointmentId: text("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    /** JSON com as zonas do olho: comprimento, curvatura e espessura por zona. */
    data: text("data", { mode: "json" }).notNull(),
    imageUrl: text("image_url"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [index("lash_maps_client_idx").on(table.clientId)],
);

export type PaymentRow = typeof payments.$inferSelect;
export type ExpenseRow = typeof expenses.$inferSelect;
export type ClientPhotoRow = typeof clientPhotos.$inferSelect;
export type LashMapRow = typeof lashMaps.$inferSelect;
