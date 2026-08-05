import "./env";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

/**
 * Aplica as migrações pendentes. Roda tanto contra o arquivo local quanto
 * contra o Turso — a diferença está só na DATABASE_URL.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida.");

  const target = url.startsWith("file:") ? `arquivo local (${url})` : "Turso";
  console.log(`→ Aplicando migrações em ${target}…`);

  const client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });

  await client.execute("PRAGMA foreign_keys = ON").catch(() => {});

  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle" });

  client.close();
  console.log("✓ Migrações aplicadas.");
}

main().catch((error) => {
  console.error("✗ Falha ao migrar:", error);
  process.exit(1);
});
