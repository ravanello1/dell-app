#!/bin/sh
#
# Rede de segurança contra vazamento de credencial.
#
# O .gitignore protege por nome de arquivo. Ele não pega o caso mais comum de
# vazamento real: uma senha ou token colado dentro de um arquivo de código
# durante um teste rápido, e esquecido lá. Este script olha o *conteúdo* do que
# está para ser commitado.
#
# Roda sozinho antes de cada commit (.githooks/pre-commit).
# Escapes: comentário `nao-e-segredo` na linha, ou `git commit --no-verify`.

set -eu

RED=$(printf '\033[31m')
YELLOW=$(printf '\033[33m')
RESET=$(printf '\033[0m')

staged=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$staged" ] && exit 0

findings=$(mktemp)
trap 'rm -f "$findings"' EXIT

# ── 1. Arquivos que nunca deveriam ser commitados ────────────────────────────
for file in $staged; do
  case "$file" in
    .env.example) ;;
    .env|.env.*) echo "$file — arquivo de ambiente com credenciais" >>"$findings" ;;
    *.pem|*.key|*.p12|*.pfx|*.keystore) echo "$file — chave privada ou certificado" >>"$findings" ;;
    *.db|*.sqlite|*.sqlite3) echo "$file — banco com dados pessoais de clientes" >>"$findings" ;;
  esac
done

# ── 2. Conteúdo com cara de credencial ───────────────────────────────────────
# Atribuições cujo valor é longo o bastante para ser um segredo de verdade.
PATTERN='(AUTH_SECRET|DATABASE_AUTH_TOKEN|secret|senha|password|passwd|token|api_?key)[[:space:]]*[=:][[:space:]]*["'\''][^"'\''[:space:]]{16,}["'\'']|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'

# Valores que existem para ilustrar, não para autenticar: exemplos da
# documentação, fixtures de teste e placeholders.
BENIGN='seu-|sua-|exemplo|example|placeholder|xxxx|<[^>]*>|\.\.\.|teste|test|dummy|fake|fixture|mock|sample|invalid|changeme|troque|nao-e-segredo'

for file in $staged; do
  [ -f "$file" ] || continue
  case "$file" in
    *.png|*.jpg|*.jpeg|*.gif|*.ico|*.svg|*.woff*|*.pdf) continue ;;
    package-lock.json|scripts/check-secrets.sh) continue ;;
  esac

  hits=$(git show ":$file" 2>/dev/null | grep -nEi "$PATTERN" | grep -vEi "$BENIGN" | head -3 || true)
  [ -n "$hits" ] || continue

  echo "$file — parece conter credencial:" >>"$findings"
  echo "$hits" | sed 's/^/      linha /' >>"$findings"
done

# ── Resultado ────────────────────────────────────────────────────────────────
if [ -s "$findings" ]; then
  echo ""
  while IFS= read -r line; do
    case "$line" in
      "      linha "*) printf '%s\n' "$line" ;;
      *) printf '%s✗ %s%s\n' "$RED" "$line" "$RESET" ;;
    esac
  done <"$findings"

  printf '\n%sCommit bloqueado.%s Tire o segredo do arquivo e use variável de ambiente.\n' \
    "$YELLOW" "$RESET"
  printf 'Se for valor de exemplo ou fixture, escreva `nao-e-segredo` na linha.\n'
  printf 'Para pular a verificação: git commit --no-verify\n\n'
  exit 1
fi

exit 0
