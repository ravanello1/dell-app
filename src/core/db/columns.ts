import { integer, text } from "drizzle-orm/sqlite-core";

/**
 * Colunas reutilizadas por praticamente toda tabela.
 *
 * IDs são UUID em texto, não autoincremento: o cliente pode gerar o id antes de
 * salvar (útil para otimismo na UI e para uma futura fila de escrita offline),
 * e ids não vazam volume de negócio.
 */
export const primaryId = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/** Datas gravadas como epoch em milissegundos (UTC). A renderização em
 *  America/Sao_Paulo acontece só na borda da UI. */
export const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
};

/** Boolean com default — SQLite guarda como 0/1. */
export const boolean = (name: string, defaultValue: boolean) =>
  integer(name, { mode: "boolean" }).notNull().default(defaultValue);
