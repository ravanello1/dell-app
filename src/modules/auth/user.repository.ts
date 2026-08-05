import { eq, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { users, type NewUserRow, type UserRow } from "./user.schema";

/**
 * Único ponto do módulo que fala com o banco. Nenhuma regra de negócio aqui —
 * só leitura e escrita.
 */

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const [row] = await db
    .select()
    .from(users)
    // Comparação sem diferenciar maiúsculas: ninguém lembra como digitou o e-mail.
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  return row;
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

export async function listUsers(): Promise<UserRow[]> {
  return db.select().from(users).orderBy(users.name);
}

export async function insertUser(values: NewUserRow): Promise<UserRow> {
  const [row] = await db.insert(users).values(values).returning();
  if (!row) throw new Error("Falha ao inserir usuário.");
  return row;
}

export async function touchLastLogin(id: string): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
}

export async function countUsers(): Promise<number> {
  const [row] = await db.select({ total: sql<number>`count(*)` }).from(users);
  return row?.total ?? 0;
}
