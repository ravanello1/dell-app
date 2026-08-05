# Dell App

Sistema de gestão do **Dell Beauty Studio** — Curitiba/PR.
Agenda, clientes e estoque num só lugar, no celular e no computador.

É um **PWA**: roda no navegador e instala como aplicativo na tela inicial do
celular e no desktop, sem loja de aplicativos e sem código separado por
plataforma.

---

## Como rodar

```bash
npm install
cp .env.example .env.local     # preencha AUTH_SECRET e SEED_OWNER_PASSWORD
npm run db:migrate             # cria as tabelas
npm run db:seed                # cria seu usuário, procedimentos e estoque inicial
npm run dev
```

Gerar um `AUTH_SECRET`:

```bash
openssl rand -base64 48
```

Abra `http://localhost:3000` e entre com o e-mail e a senha que estão no
`.env.local`.

### Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o app em desenvolvimento |
| `npm run check` | Tipos + lint + testes, tudo de uma vez |
| `npm run test` | Testes das regras de negócio (Vitest) |
| `npm run test:e2e` | Fluxo completo no navegador (Playwright) |
| `npm run build` | Build de produção |
| `npm run db:generate` | Gera migração a partir de mudanças no schema |
| `npm run db:migrate` | Aplica as migrações pendentes |
| `npm run db:studio` | Abre o navegador visual do banco |
| `npm run db:reset` | Apaga o banco local e recria do zero |

---

## Arquitetura

Monolito modularizado: um único projeto, um único deploy, com fronteiras
internas de verdade.

```
src/
├─ app/          Rotas e telas. SÓ compõe — nunca contém regra de negócio.
│  └─ api/v1/    API REST consumida pelo próprio front
├─ modules/      ★ Fatias verticais: clients · agenda · inventory · auth
│  └─ <módulo>/  schema · dto · repository · service · components
├─ core/         Infra transversal: db · api · auth · config · utils
└─ ui/           Design system (tokens e primitivos)
```

**Três regras sustentam a modularização:**

1. `app/` chama **service**, nunca **repository**.
2. Um módulo **não importa tabelas de outro** — só o contrato público.
3. Só o **repository** conversa com o banco.

A primeira é verificada pelo ESLint (`no-restricted-imports`); as outras duas
são convenção. É isso que permite, mais tarde, extrair um módulo ou trocar o
banco mexendo em uma camada só.

### Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 ·
Drizzle ORM + libSQL/Turso · Zod · TanStack Query · Vitest · Playwright

### Decisões que valem saber

**Banco.** SQLite via libSQL. Em desenvolvimento é um arquivo (`local.db`); em
produção é o mesmo SQLite hospedado no Turso, acessível por HTTP — porque o
disco da Vercel é efêmero e um arquivo local seria apagado a cada execução.
Nenhuma query muda entre os dois ambientes. Para migrar a Postgres um dia,
mexe-se em `core/db` e no dialeto do schema; os módulos não mudam.

**Autenticação própria.** Sessão em cookie assinado (JWT via `jose`) em vez de
uma biblioteca de auth. O studio tem um único método de entrada — e-mail e
senha —, sem OAuth e sem vinculação de contas. Toda a superfície cabe em
`core/auth/session.ts`, o que vale mais do que depender de um pacote em beta.
Proteção contra CSRF vem do cookie `SameSite=Lax` somada à checagem de origem
em `core/api/handler.ts`.

**Fuso horário.** Todo instante é gravado em UTC e renderizado em
`America/Sao_Paulo`. A Vercel roda em UTC: se a agenda usasse o relógio do
servidor, entre 21h e meia-noite de Curitiba o app já mostraria o dia seguinte.
A ponte entre os dois mundos está inteira em `core/utils/date.ts`.

**Dinheiro.** Sempre em centavos inteiros. Ponto flutuante acumula erro.

**Calendário próprio.** A grade da agenda é feita à mão, sem biblioteca. As
opções populares foram desenhadas para mouse — arrastar, redimensionar, tooltip
no hover — e ficam desconfortáveis no celular, que é onde o app mais é usado,
no meio de um atendimento.

**Service worker escrito à mão.** Sem gerador de precache: o worker faz cache em
tempo de execução, não guarda hashes de arquivo e por isso nunca fica preso numa
versão antiga depois de um deploy. A agenda do dia continua legível sem sinal.

### Regras de negócio (com teste)

- **Sem sobreposição na agenda.** Uma profissional não fica em dois atendimentos
  ao mesmo tempo. A checagem é no service, não num índice único, porque a
  colisão é de *intervalo* e porque a mensagem precisa dizer **com quem** o
  horário bate. Cancelados e faltas liberam o horário.
- **O razão de estoque é a verdade.** `products.current_qty` é cache; a fonte é a
  soma de `stock_movements.qty_delta`. As duas escritas acontecem na mesma
  transação, e `reconcileProduct` refaz o saldo caso divirjam.
- **Saída não deixa saldo negativo.** Quase sempre significa cadastro
  desatualizado — o caminho certo é o *ajuste de inventário*, que registra que
  houve uma contagem.
- **Um telefone, uma ficha.** Duplicata parte o histórico da cliente entre dois
  cadastros.
- **PATCH parcial não apaga o que não veio.** Campo ausente significa "não mexa";
  string vazia significa "limpe". Coberto por teste de regressão.

### LGPD

O app guarda dados pessoais e notas de saúde de clientes:

- Toda rota exige sessão (`proxy.ts` + layout + wrapper de rota — três camadas)
- Campo de consentimento com data no cadastro
- **Exportar dados** da cliente em JSON (art. 18 — direito de acesso)
- **Excluir em definitivo**, restrito à proprietária (art. 18 — eliminação)
- Notas de saúde visíveis apenas para `OWNER` e `PRO`, nunca para a recepção
- Arquivar ≠ excluir: arquivar preserva o histórico do studio

### Papéis

| Papel | Acesso |
|---|---|
| `OWNER` | Tudo: custos, procedimentos, usuários, exclusão definitiva |
| `PRO` | Agenda e fichas, incluindo notas de saúde. Sem custos |
| `RECEPTION` | Agenda e cadastro. Sem custos e sem notas de saúde |

---

## Deploy na Vercel

### 1. Banco no Turso

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup
turso db create dell-app
turso db show dell-app --url          # → DATABASE_URL
turso db tokens create dell-app       # → DATABASE_AUTH_TOKEN
```

### 2. Aplicar as migrações em produção

```bash
DATABASE_URL="libsql://..." DATABASE_AUTH_TOKEN="..." npm run db:migrate
DATABASE_URL="libsql://..." DATABASE_AUTH_TOKEN="..." \
  SEED_OWNER_EMAIL="..." SEED_OWNER_PASSWORD="..." npm run db:seed
```

### 3. Publicar

Suba o repositório para o GitHub, importe na Vercel e configure as variáveis
de ambiente (Production e Preview):

| Variável | Valor |
|---|---|
| `DATABASE_URL` | `libsql://dell-app-....turso.io` |
| `DATABASE_AUTH_TOKEN` | token gerado acima |
| `AUTH_SECRET` | `openssl rand -base64 48` — **diferente** do local |
| `NEXT_PUBLIC_STUDIO_NAME` | `Dell Beauty Studio` |
| `NEXT_PUBLIC_STUDIO_CITY` | `Curitiba` |
| `NEXT_PUBLIC_STUDIO_STATE` | `PR` |

As variáveis `SEED_*` não são necessárias na Vercel — o seed roda da sua máquina.

### 4. Conferir

Abra `https://seu-app.vercel.app/api/v1/health`. A resposta esperada:

```json
{ "data": { "status": "ok", "database": "conectado", "latencyMs": 42 } }
```

### 5. Instalar no celular

- **Android/Chrome:** abre o site → menu → "Instalar aplicativo"
- **iPhone/Safari:** abre o site → Compartilhar → "Adicionar à Tela de Início"
- **Desktop:** ícone de instalar na barra de endereço

---

## O que vem depois

A arquitetura e o banco já estão preparados para estes módulos — as tabelas
existem vazias, sem tela:

| Módulo | Já no banco |
|---|---|
| Financeiro | `payments`, `expenses` |
| Mapping de cílios + fotos | `client_photos`, `lash_maps` |
| Agendamento online público | `business_hours`, `schedule_blocks` |
| Lembretes automáticos | `appointments.reminder_sent_at` |

Criá-las desde a primeira migração foi deliberado: acrescentar chave estrangeira
num SQLite que já tem histórico real obriga a recriar a tabela inteira.
