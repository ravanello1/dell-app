import { and, asc, desc, eq, isNull, like, ne, or, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { clients, type ClientRow, type NewClientRow } from "./client.schema";
import type { ClientQuery } from "./client.dto";

/** Único ponto do módulo com acesso ao banco. */

/** Clientes excluídas (soft delete) nunca aparecem em nenhuma consulta comum. */
const notDeleted = isNull(clients.deletedAt);

export async function findClientById(id: string): Promise<ClientRow | undefined> {
  const [row] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), notDeleted))
    .limit(1);
  return row;
}

/**
 * Busca por nome ou telefone.
 *
 * O termo é limpo de tudo que não for dígito antes de bater no telefone, então
 * "(41) 99123" encontra quem está gravado como "41991234567".
 */
export async function listClients(query: ClientQuery): Promise<{
  rows: ClientRow[];
  total: number;
}> {
  const filters = [notDeleted];

  if (!query.includeInactive) {
    filters.push(eq(clients.active, true));
  }

  if (query.q) {
    const term = `%${query.q.toLowerCase()}%`;
    const digits = query.q.replace(/\D/g, "");

    const byName = sql`lower(${clients.name}) like ${term}`;
    const conditions = digits.length >= 3 ? [byName, like(clients.phone, `%${digits}%`)] : [byName];

    const combined = or(...conditions);
    if (combined) filters.push(combined);
  }

  const where = and(...filters);
  const orderBy = query.sort === "recent" ? desc(clients.createdAt) : asc(clients.name);

  const [rows, [counted]] = await Promise.all([
    db
      .select()
      .from(clients)
      .where(where)
      .orderBy(orderBy)
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    db.select({ total: sql<number>`count(*)` }).from(clients).where(where),
  ]);

  return { rows, total: counted?.total ?? 0 };
}

/** Telefone já cadastrado em outra cliente ativa? Usado para alertar duplicidade. */
export async function findClientByPhone(
  phone: string,
  excludeId?: string,
): Promise<ClientRow | undefined> {
  const filters = [eq(clients.phone, phone), notDeleted];
  if (excludeId) filters.push(ne(clients.id, excludeId));

  const [row] = await db
    .select()
    .from(clients)
    .where(and(...filters))
    .limit(1);
  return row;
}

export async function insertClient(values: NewClientRow): Promise<ClientRow> {
  const [row] = await db.insert(clients).values(values).returning();
  if (!row) throw new Error("Falha ao inserir cliente.");
  return row;
}

export async function updateClient(
  id: string,
  values: Partial<NewClientRow>,
): Promise<ClientRow | undefined> {
  const [row] = await db
    .update(clients)
    .set(values)
    .where(and(eq(clients.id, id), notDeleted))
    .returning();
  return row;
}

/** Soft delete: some das listas, mantém o histórico de atendimentos. */
export async function softDeleteClient(id: string): Promise<boolean> {
  const [row] = await db
    .update(clients)
    .set({ deletedAt: new Date(), active: false })
    .where(and(eq(clients.id, id), notDeleted))
    .returning({ id: clients.id });
  return Boolean(row);
}

/**
 * Exclusão definitiva — direito ao esquecimento da LGPD.
 * Leva junto agendamentos, fotos e mapas pela cascata declarada no schema.
 */
export async function hardDeleteClient(id: string): Promise<boolean> {
  const [row] = await db.delete(clients).where(eq(clients.id, id)).returning({ id: clients.id });
  return Boolean(row);
}

export async function countActiveClients(): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(clients)
    .where(and(notDeleted, eq(clients.active, true)));
  return row?.total ?? 0;
}

/** Clientes ativas com o mínimo que o marketing precisa: contato e nascimento. */
export async function listActiveForMarketing(): Promise<
  { id: string; name: string; phone: string; birthDate: string | null; createdAt: Date }[]
> {
  return db
    .select({
      id: clients.id,
      name: clients.name,
      phone: clients.phone,
      birthDate: clients.birthDate,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(and(notDeleted, eq(clients.active, true)))
    .orderBy(clients.name);
}

/** Aniversariantes de um mês ("01".."12") — usado no painel. */
export async function listBirthdaysInMonth(month: string): Promise<ClientRow[]> {
  return db
    .select()
    .from(clients)
    .where(
      and(
        notDeleted,
        eq(clients.active, true),
        sql`${clients.birthDate} is not null`,
        sql`substr(${clients.birthDate}, 6, 2) = ${month}`,
      ),
    )
    .orderBy(sql`substr(${clients.birthDate}, 9, 2)`);
}
