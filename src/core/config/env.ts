import { z } from "zod";

/**
 * Variáveis de ambiente do servidor, validadas no primeiro import.
 *
 * A validação acontece no boot de propósito: é melhor o processo falhar ao subir,
 * com uma mensagem clara, do que um `undefined` vazar para dentro de uma query em
 * produção. Este módulo nunca deve ser importado por um componente de cliente.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL é obrigatória (ex.: file:./local.db ou libsql://…turso.io)"),
  DATABASE_AUTH_TOKEN: z
    .string()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),

  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET precisa de no mínimo 32 caracteres. Gere com: openssl rand -base64 48"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function loadServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Ambiente inválido — o Dell App não pode iniciar.\n${problems}\n\n` +
        `Copie .env.example para .env.local e preencha os valores.`,
    );
  }

  const env = parsed.data;

  /**
   * A guarda abaixo só vale quando o app está de fato SERVINDO em ambiente
   * serverless.
   *
   * Duas exceções que parecem detalhe mas quebram o fluxo de trabalho:
   * `next build` roda com NODE_ENV=production mesmo na máquina de quem
   * desenvolve, e `next start` local também — nos dois casos apontar para o
   * arquivo `local.db` é o comportamento certo. O risco real é subir na Vercel
   * sem configurar o Turso, e a Vercel se identifica pela variável `VERCEL`.
   */
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  const isServerless = Boolean(process.env.VERCEL);

  if (isServerless && !isBuildPhase) {
    if (env.DATABASE_URL.startsWith("file:")) {
      throw new Error(
        "DATABASE_URL aponta para um arquivo local em ambiente serverless. O disco da Vercel é " +
          "efêmero e os dados seriam perdidos a cada execução. Configure a URL libsql:// do Turso.",
      );
    }
    if (!env.DATABASE_AUTH_TOKEN) {
      throw new Error("DATABASE_AUTH_TOKEN é obrigatório para conectar ao Turso.");
    }
  }

  return env;
}

export const env = loadServerEnv();
