import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { env } from "@/core/config/env";
import type { UserRole } from "@/modules/auth/user.schema";

/**
 * Sessão em cookie assinado (JWT HS256).
 *
 * Escolha deliberada de não usar uma biblioteca de autenticação: o studio tem
 * um único método de entrada (e-mail e senha), sem OAuth, sem provedores
 * externos e sem vinculação de contas. Toda a superfície cabe neste arquivo, o
 * que vale mais do que a alternativa — depender de um pacote em beta para
 * resolver um problema que não temos.
 *
 * Proteção contra CSRF vem de `SameSite=Lax` (o navegador não envia o cookie em
 * POST vindo de outro site) somada à checagem de origem em `core/api/handler`.
 */
const COOKIE_NAME = "dell_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias
const ISSUER = "dell-app";

const secretKey = new TextEncoder().encode(env.AUTH_SECRET);

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey);
}

/** Verifica assinatura e validade. Retorna null para qualquer token suspeito. */
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, { issuer: ISSUER });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role as UserRole,
    };
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await signSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Dados que o cookie *afirma* sobre quem está pedindo — assinatura conferida,
 * mas nada mais. Não decida permissão a partir daqui: o token é congelado no
 * momento do login e continua afirmando o mesmo papel por 30 dias, mesmo que a
 * pessoa tenha sido desativada ou rebaixada nesse meio-tempo.
 *
 * Para saber quem é o usuário de verdade, use `getCurrentUser` em
 * `core/auth/guard`, que confirma tudo contra o banco.
 */
export async function getSessionClaims(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
