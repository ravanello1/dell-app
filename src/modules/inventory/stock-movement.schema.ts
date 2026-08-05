import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryId } from "@/core/db/columns";
import { users } from "@/modules/auth/user.schema";
import { appointments } from "@/modules/agenda/appointment.schema";
import { products } from "./product.schema";

export const stockMovementTypes = ["IN", "OUT", "ADJUST", "LOSS"] as const;
export type StockMovementType = (typeof stockMovementTypes)[number];

export const stockMovementTypeLabels: Record<StockMovementType, string> = {
  IN: "Entrada",
  OUT: "Saída",
  ADJUST: "Ajuste de inventário",
  LOSS: "Perda / quebra",
};

/**
 * Razão de estoque — append-only. Nada aqui é editado ou apagado; um erro se
 * corrige com um movimento de ajuste, e a trilha inteira fica auditável.
 *
 * `qtyDelta` é sempre assinado (entrada positiva, saída negativa), de modo que
 * o saldo de um produto é literalmente `SUM(qty_delta)`. `balanceAfter` guarda
 * o saldo logo depois do movimento, o que torna o extrato legível sem recalcular
 * a soma acumulada linha a linha.
 */
export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: primaryId(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    type: text("type", { enum: stockMovementTypes }).notNull(),

    qtyDelta: real("qty_delta").notNull(),
    balanceAfter: real("balance_after").notNull(),

    reason: text("reason"),
    /** Custo unitário desta entrada — permite calcular custo médio depois. */
    unitCostCents: integer("unit_cost_cents"),

    /** Gancho de consumo: baixa registrada a partir de um atendimento. */
    appointmentId: text("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),

    occurredAt: integer("occurred_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("stock_movements_product_occurred_idx").on(table.productId, table.occurredAt),
    index("stock_movements_occurred_idx").on(table.occurredAt),
  ],
);

export type StockMovementRow = typeof stockMovements.$inferSelect;
export type NewStockMovementRow = typeof stockMovements.$inferInsert;
