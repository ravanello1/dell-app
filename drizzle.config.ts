import { defineConfig } from "drizzle-kit";

// Este arquivo roda fora do Next (CLI do drizzle-kit), então carrega o .env
// manualmente. `loadEnvFile` existe a partir do Node 20.12.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Em CI as variáveis já vêm do ambiente.
}

const url = process.env.DATABASE_URL ?? "file:./local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

export default defineConfig({
  schema: "./src/core/db/schema.ts",
  out: "./drizzle",
  // O dialeto `turso` fala com o servidor remoto; `sqlite` com o arquivo local.
  // O SQL gerado é idêntico nos dois casos.
  ...(authToken
    ? { dialect: "turso" as const, dbCredentials: { url, authToken } }
    : { dialect: "sqlite" as const, dbCredentials: { url } }),
  casing: "snake_case",
  strict: true,
  verbose: true,
});
