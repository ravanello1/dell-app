import { z } from "zod";

/**
 * Peças de validação reaproveitadas pelos DTOs dos módulos.
 *
 * O padrão aqui é: campo opcional vazio vira `null`, nunca string vazia. Assim
 * o banco não acumula três representações diferentes de "não informado" e as
 * telas só precisam checar uma.
 */

/**
 * Distinção que precisa sobreviver até o banco: **ausente** e **apagado** são
 * coisas diferentes.
 *
 * Num PATCH, omitir `notes` significa "não mexa nisso" e precisa chegar ao
 * service como `undefined`; enviar `null` ou `""` significa "limpe o campo".
 * Se o helper convertesse ausência em `null`, salvar só o status de um
 * agendamento apagaria as observações dele junto — foi exatamente esse bug que
 * a verificação de tipos pegou.
 *
 * Por isso a ordem é `.nullable().optional().transform()`: só o vazio explícito
 * vira `null`; o ausente continua ausente.
 */
const emptyToNull = <T extends string>(value: T | null): T | null =>
  value === null || value === "" ? null : value;

/**
 * A ordem `.transform(...).optional()` não é estética: com `.optional()` por
 * último, o Zod consegue marcar a CHAVE como opcional no tipo do objeto. Se o
 * transform viesse depois, o tipo de saída seria `notes: string | undefined` —
 * chave obrigatória de valor indefinido — e o TypeScript exigiria escrever
 * `notes` em todo PATCH, que é o oposto do que queremos.
 */

/** Texto opcional: apara espaços, limita tamanho e normaliza vazio para null. */
export const optionalText = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .nullable()
    .transform(emptyToNull)
    .optional();

export const optionalEmail = z
  .union([z.email("E-mail inválido."), z.literal("")])
  .nullable()
  .transform((value) => emptyToNull(value)?.toLowerCase() ?? null)
  .optional();

/** Data no formato "YYYY-MM-DD" — sem hora, sem fuso. */
export const optionalDateOnly = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data válida."), z.literal("")])
  .nullable()
  .transform(emptyToNull)
  .optional();

/**
 * Enum opcional vindo de um `<select>`.
 *
 * A opção "Não informado" de um select nativo manda string vazia, não `null` —
 * sem este tratamento, deixar o campo em branco reprovaria na validação do enum.
 */
export const optionalEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal("")])
    .nullable()
    .transform((value) => (value === null || value === "" ? null : (value as T[number])))
    .optional();

/** Instante recebido como ISO 8601 e convertido para Date. */
export const instant = z.union([z.iso.datetime({ offset: true }), z.iso.datetime()]).transform(
  (value) => new Date(value),
);

/** Paginação padrão de toda listagem. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

/** Query string manda tudo como texto — "true"/"false" precisam virar boolean. */
export const booleanFlag = (defaultValue = false) =>
  z
    .enum(["true", "false"])
    .default(defaultValue ? "true" : "false")
    .transform((value) => value === "true");

export const idParamSchema = z.object({
  id: z.string().min(1, "Identificador ausente."),
});

export interface PageMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
