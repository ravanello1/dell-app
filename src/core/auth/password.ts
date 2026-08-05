import bcrypt from "bcryptjs";

/**
 * bcryptjs (JavaScript puro) em vez de bcrypt nativo: em ambiente serverless
 * um binário compilado precisaria bater com a arquitetura do runtime da Vercel,
 * o que é uma fonte clássica de deploy quebrado. O custo de CPU é irrelevante
 * num login por vez.
 */
const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
