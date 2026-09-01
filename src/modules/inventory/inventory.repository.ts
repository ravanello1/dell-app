import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { users } from "@/modules/auth/user.schema";
import { products, type NewProductRow, type ProductRow } from "./product.schema";
import {
  stockMovements,
  type NewStockMovementRow,
  type StockMovementType,
} from "./stock-movement.schema";
import type { ProductQuery } from "./inventory.dto";

/** Único ponto do módulo de estoque com acesso ao banco. */

export async function listProducts(query: ProductQuery): Promise<ProductRow[]> {
  const filters = [];

  if (!query.includeInactive) filters.push(eq(products.active, true));
  if (query.category) filters.push(eq(products.category, query.category));

  if (query.q) {
    const term = `%${query.q.toLowerCase()}%`;
    const match = or(
      sql`lower(${products.name}) like ${term}`,
      sql`lower(coalesce(${products.brand}, '')) like ${term}`,
      sql`lower(coalesce(${products.spec}, '')) like ${term}`,
      sql`lower(coalesce(${products.sku}, '')) like ${term}`,
    );
    if (match) filters.push(match);
  }

  // "Abaixo do mínimo" inclui o igual: chegar no mínimo já é hora de repor.
  if (query.lowStockOnly) {
    filters.push(sql`${products.currentQty} <= ${products.minQty}`);
  }

  const orderBy =
    query.sort === "qty"
      ? [asc(products.currentQty), asc(products.name)]
      : query.sort === "category"
        ? [asc(products.category), asc(products.name)]
        : [asc(products.name)];

  return db
    .select()
    .from(products)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(...orderBy);
}

export async function findProductById(id: string): Promise<ProductRow | undefined> {
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return row;
}

export async function insertProduct(values: NewProductRow): Promise<ProductRow> {
  const [row] = await db.insert(products).values(values).returning();
  if (!row) throw new Error("Falha ao inserir produto.");
  return row;
}

export async function updateProductRow(
  id: string,
  values: Partial<NewProductRow>,
): Promise<ProductRow | undefined> {
  const [row] = await db.update(products).set(values).where(eq(products.id, id)).returning();
  return row;
}

/**
 * Grava o movimento e atualiza o saldo do produto na MESMA transação.
 *
 * Sem a transação, uma falha entre as duas escritas deixaria o razão e o saldo
 * discordando — e o saldo é justamente o que a tela mostra. Assim, ou as duas
 * acontecem, ou nenhuma.
 */
export async function recordMovement(params: {
  productId: string;
  type: StockMovementType;
  quantity: number;
  reason?: string | null;
  unitCostCents?: number | null;
  appointmentId?: string | null;
  userId: string;
}): Promise<
  | { kind: "RECORDED"; product: ProductRow }
  | { kind: "NOT_FOUND" }
  | { kind: "INSUFFICIENT"; product: ProductRow }
  | { kind: "NO_CHANGE" }
  | { kind: "CONTENDED" }
> {
  // A atualização compara o saldo que foi lido com o que ainda está no banco.
  // Se outro movimento passou antes, tentamos de novo a partir do saldo novo;
  // nunca gravamos uma linha do razão com saldo calculado fora da transação.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await db.transaction(async (tx) => {
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, params.productId))
        .limit(1);
      if (!product) return { kind: "NOT_FOUND" } as const;

      const quantity = Math.round(params.quantity * 1000) / 1000;
      const qtyDelta =
        params.type === "IN"
          ? quantity
          : params.type === "OUT" || params.type === "LOSS"
            ? -quantity
            : quantity - product.currentQty;
      const balanceAfter = Math.round((product.currentQty + qtyDelta) * 1000) / 1000;

      if (balanceAfter < 0) return { kind: "INSUFFICIENT", product } as const;
      if (qtyDelta === 0) return { kind: "NO_CHANGE" } as const;

      // A cláusula com o saldo anterior funciona como controle otimista de
      // concorrência. Sem ela, duas saídas poderiam sobrescrever o cache uma
      // da outra e registrar `balanceAfter` incompatível no razão.
      const [updated] = await tx
        .update(products)
        .set({ currentQty: balanceAfter, updatedAt: new Date() })
        .where(and(eq(products.id, params.productId), eq(products.currentQty, product.currentQty)))
        .returning();
      if (!updated) return { kind: "RETRY" } as const;

    const movement: NewStockMovementRow = {
      productId: params.productId,
      type: params.type,
      qtyDelta,
      balanceAfter,
      reason: params.reason ?? null,
      unitCostCents: params.unitCostCents ?? null,
      appointmentId: params.appointmentId ?? null,
      userId: params.userId,
      occurredAt: new Date(),
    };

    await tx.insert(stockMovements).values(movement);
    return { kind: "RECORDED", product: updated } as const;
    });

    if (result.kind !== "RETRY") return result;
  }

  return { kind: "CONTENDED" };
}

export async function listMovements(productId: string, limit = 60) {
  return db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      qtyDelta: stockMovements.qtyDelta,
      balanceAfter: stockMovements.balanceAfter,
      reason: stockMovements.reason,
      unitCostCents: stockMovements.unitCostCents,
      occurredAt: stockMovements.occurredAt,
      userName: users.name,
    })
    .from(stockMovements)
    .leftJoin(users, eq(stockMovements.userId, users.id))
    .where(eq(stockMovements.productId, productId))
    .orderBy(desc(stockMovements.occurredAt))
    .limit(limit);
}

/** Soma do razão — a verdade contra a qual o saldo em cache é conferido. */
export async function sumMovements(productId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${stockMovements.qtyDelta}), 0)` })
    .from(stockMovements)
    .where(eq(stockMovements.productId, productId));
  return row?.total ?? 0;
}

/** Produtos que precisam de reposição — alimenta o alerta do painel. */
export async function listLowStock(): Promise<ProductRow[]> {
  return db
    .select()
    .from(products)
    .where(and(eq(products.active, true), sql`${products.currentQty} <= ${products.minQty}`))
    .orderBy(asc(products.currentQty), asc(products.name));
}

export async function countProducts(): Promise<{ total: number; low: number }> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      low: sql<number>`sum(case when ${products.currentQty} <= ${products.minQty} then 1 else 0 end)`,
    })
    .from(products)
    .where(eq(products.active, true));

  return { total: row?.total ?? 0, low: row?.low ?? 0 };
}
