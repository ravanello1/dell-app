import { redirect } from "next/navigation";
import { ForbiddenError, UnauthorizedError } from "@/core/api/errors";
import { getSession, type SessionUser } from "./session";
import type { UserRole } from "@/modules/auth/user.schema";

/**
 * Guardas de acesso.
 *
 * Versões `require*` lançam AppError e são para a API — o wrapper de rota
 * converte em 401/403. Versões `ensure*` redirecionam e são para páginas.
 */

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function requireRole(...roles: readonly UserRole[]): Promise<SessionUser> {
  const session = await requireSession();
  if (roles.length > 0 && !roles.includes(session.role)) {
    throw new ForbiddenError();
  }
  return session;
}

/** Para Server Components: manda para o login em vez de estourar erro. */
export async function ensureSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Só a proprietária vê custo de produto, fechamento e gestão de usuários. */
export function canSeeCosts(user: SessionUser): boolean {
  return user.role === "OWNER";
}

/** Excluir cliente em definitivo (LGPD) e apagar registros é ação de dona. */
export function canDeletePermanently(user: SessionUser): boolean {
  return user.role === "OWNER";
}

export function canManageSettings(user: SessionUser): boolean {
  return user.role === "OWNER";
}
