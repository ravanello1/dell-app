import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryId, timestamps } from "@/core/db/columns";
import { users } from "@/modules/auth/user.schema";
import { clients } from "@/modules/clients/client.schema";
import { professionals } from "@/modules/agenda/professional.schema";

/**
 * Fichas de anamnese.
 *
 * Uma ficha nasce como rascunho (`DRAFT`), é preenchida, e ao ser assinada por
 * cliente e profissional vira `SIGNED` — e a partir daí é imutável: é um
 * documento assinado, corrigir significa criar uma ficha nova. Cada cliente
 * pode ter várias fichas ao longo do tempo; a mais recente é a vigente e as
 * anteriores ficam como histórico.
 *
 * É dado de saúde, sensível sob a LGPD — o service restringe todo acesso a
 * OWNER e PRO, como já acontece com as observações de saúde da cliente.
 */
export const anamneseStatuses = ["DRAFT", "SIGNED"] as const;
export type AnamneseStatus = (typeof anamneseStatuses)[number];

/**
 * Cada procedimento tem sua própria ficha, com perguntas específicas além das
 * padrão. O catálogo de perguntas por tipo vive em `anamnese.questions.ts`.
 * `CILIOS` (extensão) foi o primeiro e é o default das fichas já existentes.
 */
export const anamneseProcedures = ["CILIOS", "LASH_LIFTING", "BROW_LAMINATION", "HENNA"] as const;
export type AnamneseProcedure = (typeof anamneseProcedures)[number];

export const anamneseForms = sqliteTable(
  "anamnese_forms",
  {
    id: primaryId(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    /** Qual procedimento esta ficha cobre — define o conjunto de perguntas. */
    procedure: text("procedure", { enum: anamneseProcedures }).notNull().default("CILIOS"),
    status: text("status", { enum: anamneseStatuses }).notNull().default("DRAFT"),

    /** Respostas do questionário: `{ [perguntaId]: { value: boolean, detail?: string } }`.
     *  As perguntas em si vivem em `anamnese.questions.ts`. */
    answers: text("answers", { mode: "json" }).notNull().default("{}"),
    observations: text("observations"),

    // ── Assinaturas (preenchidas só ao assinar) ──────────────────────────────
    /** PNG desenhado na tela, guardado como data URI (`data:image/png;base64,…`). */
    clientSignature: text("client_signature"),
    professionalSignature: text("professional_signature"),
    professionalId: text("professional_id").references(() => professionals.id, {
      onDelete: "set null",
    }),

    /** Identidade congelada no momento da assinatura — cliente e responsável
     *  técnica —, para que o documento não mude se o cadastro for editado
     *  depois. `{ client: {...}, professional: {...}, declaration: string }`. */
    signedSnapshot: text("signed_snapshot", { mode: "json" }),
    signedAt: integer("signed_at", { mode: "timestamp_ms" }),

    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("anamnese_client_created_idx").on(table.clientId, table.createdAt),
    index("anamnese_status_idx").on(table.status),
  ],
);

export type AnamneseRow = typeof anamneseForms.$inferSelect;
export type NewAnamneseRow = typeof anamneseForms.$inferInsert;
