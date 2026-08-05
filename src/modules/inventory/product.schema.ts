import { index, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { integer } from "drizzle-orm/sqlite-core";
import { boolean, primaryId, timestamps } from "@/core/db/columns";

export const productUnits = ["UN", "PAR", "CX", "KIT", "ML", "G"] as const;
export type ProductUnit = (typeof productUnits)[number];

export const productUnitLabels: Record<ProductUnit, string> = {
  UN: "unidade",
  PAR: "par",
  CX: "caixa",
  KIT: "kit",
  ML: "ml",
  G: "g",
};

export const productCategories = [
  "CILIOS",
  "COLA",
  "REMOVEDOR",
  "PRIMER",
  "DESCARTAVEL",
  "SOBRANCELHA",
  "HIGIENE",
  "FERRAMENTA",
  "OUTRO",
] as const;
export type ProductCategory = (typeof productCategories)[number];

export const productCategoryLabels: Record<ProductCategory, string> = {
  CILIOS: "Cílios",
  COLA: "Cola",
  REMOVEDOR: "Removedor",
  PRIMER: "Primer / Selante",
  DESCARTAVEL: "Descartáveis",
  SOBRANCELHA: "Sobrancelha",
  HIGIENE: "Higiene",
  FERRAMENTA: "Ferramentas",
  OUTRO: "Outro",
};

export const suppliers = sqliteTable("suppliers", {
  id: primaryId(),
  name: text("name").notNull(),
  phone: text("phone"),
  notes: text("notes"),
  active: boolean("active", true),
  ...timestamps,
});

export const products = sqliteTable(
  "products",
  {
    id: primaryId(),
    name: text("name").notNull(),
    brand: text("brand"),
    category: text("category", { enum: productCategories }).notNull().default("OUTRO"),
    /** Especificação livre: "C 0.07 · 11mm", "volume russo 0.05", etc. */
    spec: text("spec"),
    sku: text("sku"),
    unit: text("unit", { enum: productUnits }).notNull().default("UN"),

    /** Saldo atual. É um cache: a verdade é a soma de `stock_movements.qty_delta`,
     *  e `inventory.service` sabe reconciliar os dois. */
    currentQty: real("current_qty").notNull().default(0),
    /** Abaixo disso o produto aparece no alerta de reposição do painel. */
    minQty: real("min_qty").notNull().default(0),

    costCents: integer("cost_cents").notNull().default(0),
    supplierId: text("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    /** "YYYY-MM-DD" — validade não tem fuso horário. */
    expiresAt: text("expires_at"),

    notes: text("notes"),
    active: boolean("active", true),
    ...timestamps,
  },
  (table) => [
    index("products_name_idx").on(table.name),
    index("products_category_idx").on(table.category),
    index("products_active_idx").on(table.active),
  ],
);

export type SupplierRow = typeof suppliers.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type NewProductRow = typeof products.$inferInsert;
