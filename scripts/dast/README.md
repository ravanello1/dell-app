# DAST — teste dinâmico de segurança

Dois scanners que exercem o app rodando, de fora, como um atacante faria.
Complementam os testes unitários: aqueles provam a regra isolada, estes provam
o sistema inteiro de pé, com HTTP, sessão e banco reais.

## `surface.mjs` — só leitura, seguro em produção

Não faz login e não altera estado. Verifica cabeçalhos de segurança, TLS,
arquivos que não podem estar expostos (`.env`, `.git`, banco), a parede de
sessão (rotas protegidas devem recusar quem não tem cookie) e a barreira de
origem (CSRF). O único POST que envia é de outra origem, de propósito — a
expectativa é ser barrado antes de tocar no banco.

```bash
node scripts/dast/surface.mjs https://dell-app.vercel.app   # produção
node scripts/dast/surface.mjs http://127.0.0.1:3000         # local
```

## `authed.ts` — autenticado, SÓ em alvo descartável

Entra com sessão de cada papel (OWNER, PRO, RECEPTION) e ataca por dentro:
escalada de privilégio, exposição de campo sensível, injection nos parâmetros
reais, mass assignment, IDOR, sessão de usuário desativado, cookie forjado e
JWT `alg:none`. **Escreve no banco** — nunca aponte para produção.

Ele assina os cookies de sessão com a mesma função do app, lendo os ids reais
do banco-alvo, então não depende do id interno da Server Action de login.

```bash
# 1. Suba um alvo isolado (banco descartável)
cp .env.example .env.dast   # edite DATABASE_URL="file:./.dast.db" e um AUTH_SECRET qualquer
ENV_FILE=.env.dast npx tsx scripts/migrate.ts
ENV_FILE=.env.dast npx tsx scripts/seed.ts
# crie usuários pro@ / recep@ / off@dast.local (ver histórico do projeto)

# 2. Rode o app apontando para esse banco, noutra porta
sh -c 'set -a; . ./.env.dast; set +a; next start -p 4199'

# 3. Ataque
ENV_FILE=.env.dast npx tsx scripts/dast/authed.ts http://127.0.0.1:4199

# 4. Destrua o alvo
rm -f .dast.db* .env.dast
```

## Ferramentas externas usadas junto

- **nuclei** — `nuclei -u <alvo> -t <templates>/http/ -severity low,medium,high,critical`
- **nikto** — `nikto -h <alvo>` (varredura de servidor; muito do que reporta é
  ruído para um app Next.js — leia com ceticismo)
