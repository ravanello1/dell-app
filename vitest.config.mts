import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Cada arquivo de teste que toca o banco usa um arquivo SQLite próprio,
    // então os testes podem correr em paralelo sem disputar o mesmo estado.
    globals: false,
    env: {
      NODE_ENV: "test",
      AUTH_SECRET: "segredo-de-teste-com-tamanho-mais-que-suficiente-aqui",
      DATABASE_URL: "file:./.test.db",
    },
  },
});
