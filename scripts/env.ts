/**
 * Carrega o .env.local para os scripts que rodam fora do Next (migração, seed).
 * Importe este módulo antes de qualquer outro que leia `process.env`.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // Em CI e na Vercel as variáveis já vêm do ambiente.
}
