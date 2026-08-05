import { and, desc, eq } from "drizzle-orm";
import { db } from "@/core/db";
import { anamneseForms, type AnamneseRow, type NewAnamneseRow } from "./anamnese.schema";

/** Único ponto do módulo com acesso ao banco. Nenhuma regra aqui. */

export async function findById(id: string): Promise<AnamneseRow | undefined> {
  const [row] = await db.select().from(anamneseForms).where(eq(anamneseForms.id, id)).limit(1);
  return row;
}

/** Todas as fichas de uma cliente, da mais recente para a mais antiga. */
export async function listByClient(clientId: string): Promise<AnamneseRow[]> {
  return db
    .select()
    .from(anamneseForms)
    .where(eq(anamneseForms.clientId, clientId))
    .orderBy(desc(anamneseForms.createdAt));
}

/** A ficha vigente da cliente é a mais recente (rascunho ou assinada). */
export async function findCurrentByClient(clientId: string): Promise<AnamneseRow | undefined> {
  const [row] = await db
    .select()
    .from(anamneseForms)
    .where(eq(anamneseForms.clientId, clientId))
    .orderBy(desc(anamneseForms.createdAt))
    .limit(1);
  return row;
}

/** Rascunho aberto da cliente, se houver — evita criar dois rascunhos soltos. */
export async function findOpenDraftByClient(clientId: string): Promise<AnamneseRow | undefined> {
  const [row] = await db
    .select()
    .from(anamneseForms)
    .where(and(eq(anamneseForms.clientId, clientId), eq(anamneseForms.status, "DRAFT")))
    .orderBy(desc(anamneseForms.createdAt))
    .limit(1);
  return row;
}

export async function insert(values: NewAnamneseRow): Promise<AnamneseRow> {
  const [row] = await db.insert(anamneseForms).values(values).returning();
  if (!row) throw new Error("Falha ao criar a anamnese.");
  return row;
}

/** Atualiza só se ainda for rascunho — a cláusula protege contra corrida com a
 *  assinatura. Devolve undefined se a ficha já não era mais um rascunho. */
export async function updateDraft(
  id: string,
  values: Partial<NewAnamneseRow>,
): Promise<AnamneseRow | undefined> {
  const [row] = await db
    .update(anamneseForms)
    .set(values)
    .where(and(eq(anamneseForms.id, id), eq(anamneseForms.status, "DRAFT")))
    .returning();
  return row;
}

export async function deleteDraft(id: string): Promise<boolean> {
  const [row] = await db
    .delete(anamneseForms)
    .where(and(eq(anamneseForms.id, id), eq(anamneseForms.status, "DRAFT")))
    .returning({ id: anamneseForms.id });
  return Boolean(row);
}

export async function countByClient(clientId: string): Promise<number> {
  const rows = await db
    .select({ id: anamneseForms.id })
    .from(anamneseForms)
    .where(eq(anamneseForms.clientId, clientId));
  return rows.length;
}
