import { cache } from "react";
import { redirect } from "next/navigation";
import { ForbiddenError, UnauthorizedError } from "@/core/api/errors";
import { resolveSessionUser } from "@/modules/auth/auth.service";
import { getSessionClaims, type SessionUser } from "./session";
import type { UserRole } from "@/modules/auth/user.schema";

/**
 * Guardas de acesso.
 *
 * Versões `require*` lançam AppError e são para a API — o wrapper de rota
 * converte em 401/403. Versões `ensure*` redirecionam e são para páginas.
 */

/**
 * Quem está pedindo, confirmado contra o banco.
 *
 * São duas etapas de propósito. O `proxy.ts` faz só a conferência barata da
 * assinatura, para barrar quem nem cookie tem sem consultar o banco a cada
 * requisição. Aqui, onde a permissão de fato é decidida, o usuário é carregado
 * do banco: existe? está ativo? qual é o papel dele *agora*?
 *
 * O `cache` do React memoriza por requisição — uma página que chame isto no
 * layout e em três services faz uma consulta só.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const claims = await getSessionClaims();
  if (!claims) return null;
  return resolveSessionUser(claims.id);
});

export async function requireSession(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireRole(...roles: readonly UserRole[]): Promise<SessionUser> {
  const session = await requireSession();
  if (roles.length > 0 && !roles.includes(session.role)) {
    throw new ForbiddenError();
  }
  return session;
}

/**
 * Para Server Components: manda para o login em vez de estourar erro.
 *
 * Quando o cookie é válido mas o usuário sumiu ou foi desativado, o destino é
 * `/sair`, não `/login`: o `proxy` devolveria quem tem token válido de volta ao
 * painel, e página e proxy ficariam se empurrando em laço. `/sair` apaga o
 * cookie primeiro, o que quebra o ciclo na origem.
 */
export async function ensureSession(): Promise<SessionUser> {
  const claims = await getSessionClaims();
  if (!claims) redirect("/login");

  const user = await resolveSessionUser(claims.id);
  if (!user) redirect("/sair?motivo=sessao-invalida");

  return user;
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
