/**
 * Carrega o arquivo de ambiente para os scripts que rodam fora do Next
 * (migração, seed). Importe este módulo antes de qualquer outro que leia
 * `process.env`.
 *
 * Por padrão usa o `.env.local` — o banco em arquivo, do dia a dia. Os comandos
 * `:remote` apontam `ENV_FILE` para o `.env.turso`, que é o banco de verdade.
 * Deixar a escolha explícita num arquivo separado evita o acidente clássico de
 * rodar um seed achando que está no local e escrever em produção.
 */
const file = process.env.ENV_FILE ?? ".env.local";

try {
  process.loadEnvFile(file);
} catch {
  // Em CI e na Vercel as variáveis já vêm do ambiente do processo.
}

const url = process.env.DATABASE_URL ?? "";
const target = url.startsWith("file:") ? "banco local (arquivo)" : "TURSO — banco de produção";
console.log(`· ambiente: ${file} → ${target}`);
