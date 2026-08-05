# Dell App — guia para trabalhar neste projeto

Sistema de gestão do Dell Beauty Studio (Curitiba/PR). PWA em Next.js 16,
monolito modularizado, hospedado na Vercel com banco libSQL/Turso.

Leia o `README.md` para a visão geral. Este arquivo cobre o que muda a forma de
escrever código aqui.

## Fronteiras que não se cruzam

```
app/  →  service  →  repository  →  banco
```

1. `src/app/**` importa **service**, nunca **repository** nem `@/core/db`.
   O ESLint bloqueia (`no-restricted-imports`).
2. Um módulo não importa tabelas de outro. Precisa de dado alheio? Chame o
   service público dele. `dashboard.service.ts` é o exemplo: costura os três
   módulos sem que nenhum conheça o outro.
3. Só o repository escreve SQL.

Um módulo novo é uma pasta em `src/modules/<nome>/` com
`*.schema.ts` · `*.dto.ts` · `*.repository.ts` · `*.service.ts` · `components/`.

## Convenções que evitam bugs conhecidos

**Dinheiro** em centavos inteiros (`priceCents`, `costCents`). Nunca float.
Conversão só na borda: `formatCents` / `inputToCents`.

**Datas** gravadas em UTC (`timestamp_ms`), exibidas em `America/Sao_Paulo`.
Use sempre `core/utils/date.ts` — nunca `new Date()` cru para lógica de
calendário, porque o servidor da Vercel roda em UTC. Datas sem hora (nascimento,
validade) são texto `"YYYY-MM-DD"`.

**Campos opcionais** usam os helpers de `core/api/dto.ts`
(`optionalText`, `optionalEmail`, `optionalEnum`, `optionalDateOnly`). A ordem
`.nullable().transform(...).optional()` é obrigatória: com `.optional()` por
último o Zod marca a **chave** como opcional, e um PATCH que omite o campo não
o apaga. Já foi bug.

**Schemas de atualização** são escritos à mão, sem `.partial()` do schema de
criação: `.partial()` mantém os `.default()` ativos e um PATCH parcial
reaplicaria os padrões, apagando escolhas do usuário. Também já foi bug — há
teste de regressão em `tests/unit/dto.test.ts`.

**Rotas de API** sempre via `defineRoute` (`core/api/handler.ts`). Ele resolve
sessão, papéis, validação Zod, checagem de origem e tradução de erro para HTTP.
Erros de domínio são as classes de `core/api/errors.ts` — o service lança, o
wrapper traduz.

**Diálogos** recebem `key` de quem os monta, para remontar com valores novos.
Não use `useEffect` para resetar estado de formulário.

**Cores** vêm dos tokens em `app/globals.css`. Ouro (`gold-500`) é identidade —
bordas, ícones, detalhes; nunca texto pequeno sobre branco (2,4:1, reprova em
acessibilidade). Texto e links dourados usam `gold-700`. Rosa (`rose-600`) é
ação. No Tailwind v4 a sintaxe de variável é `rounded-(--radius-field)`, com
parênteses, não colchetes.

## Antes de dizer que terminou

```bash
npm run check      # tipos + lint + testes
npm run build      # o build roda o typecheck de novo, inclusive dos testes
```

Regra de negócio nova precisa de teste em `tests/unit/`. As que tocam o banco
usam `business-rules.test.ts`, que roda contra um SQLite de verdade — dublê não
provaria nada, porque as regras dependem de estado acumulado.

O e2e (`npm run test:e2e`) precisa do dev server e roda em desktop e celular.
Se já houver um `next dev` ativo, aponte para ele: `E2E_PORT=<porta> npx playwright test`.

## Contexto do negócio

Studio pequeno, uma profissional principal, atendimentos de 30 min a 2h30.
Quem usa o app está de pé, com o celular numa mão, no meio de um atendimento —
por isso alvos de toque grandes, seletores nativos e a agenda em lista no
celular. Mensagens de erro dizem o que fazer a seguir, não só o que deu errado.
