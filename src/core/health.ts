import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Verifica se a aplicação alcança o banco.
 *
 * Existe como módulo próprio porque a regra do projeto é que `app/` nunca
 * importe o banco diretamente — nem para uma consulta trivial. A rota de saúde
 * chama esta função e não sabe qual banco existe do outro lado.
 */
export async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
  const startedAt = Date.now();
  await db.run(sql`select 1`);
  return { ok: true, latencyMs: Date.now() - startedAt };
}
