import { z } from "zod";
import { UnauthorizedError } from "@/core/api/errors";
import { hashPassword, verifyPassword } from "@/core/auth/password";
import type { SessionUser } from "@/core/auth/session";
import { findUserByEmail, insertUser, touchLastLogin } from "./user.repository";
import { userRoles } from "./user.schema";

export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome."),
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
  role: z.enum(userRoles),
});

/**
 * Valida credenciais e devolve os dados que entram na sessão.
 *
 * A mensagem de erro é a mesma para e-mail inexistente, senha errada e conta
 * desativada — de propósito. Diferenciar os casos contaria a um atacante quais
 * e-mails existem no sistema.
 */
export async function authenticate(input: LoginInput): Promise<SessionUser> {
  const user = await findUserByEmail(input.email);

  // Compara mesmo sem usuário encontrado: o tempo de resposta fica constante e
  // não vaza, pela demora, se aquele e-mail existe ou não.
  const hash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
  const passwordMatches = await verifyPassword(input.password, hash);

  if (!user || !passwordMatches || !user.active) {
    throw new UnauthorizedError("E-mail ou senha incorretos.");
  }

  await touchLastLogin(user.id);

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function createUser(input: z.infer<typeof createUserSchema>) {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new UnauthorizedError("Já existe um usuário com este e-mail.");
  }

  const user = await insertUser({
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: await hashPassword(input.password),
    role: input.role,
  });

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
