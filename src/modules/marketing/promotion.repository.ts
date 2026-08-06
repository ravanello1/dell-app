import { desc, eq } from "drizzle-orm";
import { db } from "@/core/db";
import { promotions, type NewPromotionRow, type PromotionRow } from "./promotion.schema";

/** Único ponto do módulo com acesso ao banco. */

export async function listPromotions(): Promise<PromotionRow[]> {
  return db.select().from(promotions).orderBy(desc(promotions.createdAt));
}

export async function findById(id: string): Promise<PromotionRow | undefined> {
  const [row] = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
  return row;
}

export async function insert(values: NewPromotionRow): Promise<PromotionRow> {
  const [row] = await db.insert(promotions).values(values).returning();
  if (!row) throw new Error("Falha ao criar a promoção.");
  return row;
}

export async function update(
  id: string,
  values: Partial<NewPromotionRow>,
): Promise<PromotionRow | undefined> {
  const [row] = await db.update(promotions).set(values).where(eq(promotions.id, id)).returning();
  return row;
}

export async function remove(id: string): Promise<boolean> {
  const [row] = await db.delete(promotions).where(eq(promotions.id, id)).returning({ id: promotions.id });
  return Boolean(row);
}
