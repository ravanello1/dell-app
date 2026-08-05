import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Token do link público de anamnese.
 *
 * O token é 256 bits de aleatoriedade — impossível de adivinhar por força bruta,
 * então um hash rápido (SHA-256) basta; não precisa de bcrypt, que existe para
 * proteger segredos de baixa entropia como senhas.
 *
 * No banco guardamos só o hash. O token cru só existe na URL enviada à cliente,
 * então um vazamento do banco não entrega nenhum link utilizável.
 */

/** Gera um token novo e seu hash. Devolva o token só uma vez — ele não é
 *  recuperável depois, por design. */
export function generateAnamneseToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashAnamneseToken(token) };
}

export function hashAnamneseToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Comparação em tempo constante — não vaza, pela demora, quantos caracteres
 *  do hash bateram. Aqui é acessório (o lookup é por igualdade no banco), mas
 *  fica disponível para comparações em memória. */
export function tokensMatch(hashA: string, hashB: string): boolean {
  const a = Buffer.from(hashA);
  const b = Buffer.from(hashB);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Validade padrão do link: 7 dias. */
export const PUBLIC_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
