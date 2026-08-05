import js from "@eslint/js";
import tseslint from "typescript-eslint";
import next from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "drizzle/**",
      "public/sw.js",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...next,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // `consistent-type-imports` ficaria aqui, mas exige linting com informação
      // de tipos — lento e redundante: o `verbatimModuleSyntax` do tsconfig já
      // obriga `import type` no compilador, que é onde importa.
    },
  },
  {
    // Regra que sustenta a modularização: telas e rotas conversam com o service
    // do módulo, nunca com o repositório ou com o banco diretamente.
    files: ["src/app/**/*.{ts,tsx}", "src/modules/**/components/**/*.{ts,tsx}", "src/ui/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/*.repository", "@/core/db", "@/core/db/*"],
              message:
                "Acesso ao banco pertence ao repository do módulo. Importe o service correspondente.",
            },
          ],
        },
      ],
    },
  },
  prettier,
);
