import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "@/core/config/env";
import * as schema from "./schema";

/**
 * Conexão com o banco.
 *
 * O mesmo código serve para os dois ambientes: em desenvolvimento a URL é
 * `file:./local.db` (SQLite em arquivo) e em produção é `libsql://…turso.io`
 * (o mesmo SQLite, acessado por HTTP). Nenhuma query muda entre os dois.
 *
 * Em desenvolvimento o Next recarrega os módulos a cada alteração; guardar a
 * instância no `globalThis` evita abrir uma conexão nova a cada hot reload.
 */
const globalForDb = globalThis as unknown as {
  __dellAppLibsql?: Client;
};

function createLibsqlClient(): Client {
  const client = createClient({
    url: env.DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN,
  });

  // SQLite ignora chaves estrangeiras a menos que sejam ligadas explicitamente.
  // Sem isto, `ON DELETE CASCADE` no schema seria decorativo.
  void client.execute("PRAGMA foreign_keys = ON").catch(() => {
    /* servidores libSQL remotos já vêm com a checagem ativa */
  });

  return client;
}

const client = globalForDb.__dellAppLibsql ?? createLibsqlClient();
if (env.NODE_ENV !== "production") globalForDb.__dellAppLibsql = client;

export const db = drizzle(client, { schema, casing: "snake_case" });

export type Database = typeof db;
export { schema };
