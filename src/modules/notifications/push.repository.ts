import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/core/db";
import { users } from "@/modules/auth/user.schema";
import {
  pushSubscriptions,
  type NewPushSubscriptionRow,
  type PushSubscriptionRow,
} from "./push.schema";
import type { UserRole } from "@/modules/auth/user.schema";

/** Único ponto do módulo com acesso ao banco. */

/** Grava a inscrição; se o endpoint já existe (mesmo aparelho), atualiza as
 *  chaves e reaponta para o usuário atual. */
export async function upsertSubscription(values: NewPushSubscriptionRow): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: values.userId,
        p256dh: values.p256dh,
        auth: values.auth,
        userAgent: values.userAgent,
      },
    });
}

export async function deleteByEndpoint(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/** Inscrições dos usuários ativos que têm algum dos papéis dados. */
export async function findByRoles(roles: readonly UserRole[]): Promise<PushSubscriptionRow[]> {
  return db
    .select()
    .from(pushSubscriptions)
    .innerJoin(users, eq(users.id, pushSubscriptions.userId))
    .where(and(inArray(users.role, [...roles]), eq(users.active, true)))
    .then((rows) => rows.map((r) => r.push_subscriptions));
}

/** Inscrições (aparelhos) de um usuário específico — usado no envio de teste. */
export async function findByUser(userId: string): Promise<PushSubscriptionRow[]> {
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

export async function countForUser(userId: string): Promise<number> {
  const rows = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  return rows.length;
}
