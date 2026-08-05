import "./env";
import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { users } from "@/modules/auth/user.schema";
import { hashPassword } from "@/core/auth/password";
import { promptNewPassword } from "./prompt";

/**
 * Troca a senha de um usuário.
 *
 *   npm run user:password              -- no banco local
 *   npm run user:password:remote       -- no banco de produção (Turso)
 *
 * O e-mail pode vir como argumento; sem ele, usa o SEED_OWNER_EMAIL.
 * A senha é digitada no terminal e nunca toca em arquivo nem em variável.
 */
async function main() {
  const email = (process.argv[2] ?? process.env.SEED_OWNER_EMAIL ?? "").trim().toLowerCase();

  if (!email) {
    throw new Error("Informe o e-mail: npm run user:password -- alguem@exemplo.com");
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    throw new Error(`Nenhum usuário com o e-mail ${email} neste banco.`);
  }

  console.log(`\nTrocando a senha de ${user.name} <${user.email}>\n`);

  const password = await promptNewPassword();
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, user.id));

  console.log("\n✓ Senha atualizada. As sessões abertas continuam válidas até expirarem.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  });
