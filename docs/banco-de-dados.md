# Bancos de dados do Dell App

O app fala com dois bancos. Os dois são SQLite — a diferença é onde moram.

| | Arquivo de ambiente | Onde fica | Para que serve |
|---|---|---|---|
| **Local** | `.env.local` | `local.db`, na pasta do projeto | Desenvolver e testar. Pode apagar à vontade |
| **Produção** | `.env.turso` | Turso, em `aws-us-east-1` | O banco de verdade, o que a Vercel usa |

Nenhum dos dois arquivos vai para o Git — o `.gitignore` bloqueia todo `.env*`,
menos o `.env.example`, que não tem segredo nenhum.

## Por que Virginia, e não São Paulo

O Turso não tem datacenter na América do Sul; Virginia é o mais próximo do
Brasil na lista. Isso torna uma coisa importante: **a Vercel precisa rodar na
mesma região**, senão cada página faria várias viagens Brasil↔EUA em vez de uma.
Por isso o `vercel.json` fixa `"regions": ["iad1"]` — Washington, ao lado do
banco. Assim o usuário paga uma travessia só, e as consultas do servidor ao
banco levam poucos milissegundos.

## Comandos

Os comandos do dia a dia mexem no banco local. Os terminados em `:remote`
mexem no banco de verdade — e todos anunciam em qual banco estão antes de agir.

```bash
npm run db:migrate          # aplica migrações no local
npm run db:seed             # dados iniciais no local
npm run db:reset            # apaga o local e recomeça do zero
```

```bash
npm run db:migrate:remote   # aplica migrações no Turso
npm run db:seed:remote      # dados iniciais no Turso
```

### Trocar a senha de acesso

A senha nunca fica salva em arquivo: é digitada no terminal, sem aparecer na
tela, e vai direto para o bcrypt.

```bash
npm run user:password:remote
```

Para trocar a de outra pessoa, passe o e-mail:

```bash
npm run user:password:remote -- alguem@dellbeautystudio.com.br
```

### Rodar o app apontando para o banco de verdade

Útil para conferir a produção sem publicar. Cuidado: o que você criar aqui
entra no banco real.

```bash
npm run dev:remote
```

## Criar uma migração nova

Depois de mudar qualquer `*.schema.ts`:

```bash
npm run db:generate
```

Confira o SQL gerado em `drizzle/`, aplique no local, teste, e só então aplique
no remoto. Migração é a única coisa que roda antes do deploy, nunca depois.
