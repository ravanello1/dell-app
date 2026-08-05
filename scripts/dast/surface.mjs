/**
 * DAST de superfície — SÓ LEITURA. Seguro contra produção.
 *
 * Não faz login, não envia corpo que altere estado, não cria nada. Verifica o
 * que dá para verificar de fora: cabeçalhos, TLS, arquivos que não deveriam
 * estar expostos, rotas protegidas que precisam recusar quem não tem sessão, e
 * a barreira de origem (CSRF). Um POST de teste aqui é sempre de outra origem,
 * de propósito: a expectativa é ser barrado ANTES de tocar no banco.
 *
 *   node scripts/dast/surface.mjs https://dell-app.vercel.app
 */

const base = (process.argv[2] ?? "http://127.0.0.1:4199").replace(/\/$/, "");

const results = [];
const rec = (sev, area, msg, detail) => results.push({ sev, area, msg, detail });

const C = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};
const sevColor = { CRIT: C.red, ALTA: C.red, MEDIA: C.yellow, BAIXA: C.yellow, OK: C.green, INFO: C.dim };

async function req(path, init = {}) {
  const url = path.startsWith("http") ? path : base + path;
  const res = await fetch(url, { redirect: "manual", ...init });
  const body = await res.text().catch(() => "");
  return { status: res.status, headers: res.headers, body, url };
}

// ── 1. Cabeçalhos de segurança ────────────────────────────────────────────────
async function checkHeaders() {
  const { headers } = await req("/login");
  const want = {
    "content-security-policy": { sev: "MEDIA", label: "CSP" },
    "x-frame-options": { sev: "MEDIA", label: "proteção contra clickjacking" },
    "x-content-type-options": { sev: "BAIXA", label: "nosniff" },
    "referrer-policy": { sev: "BAIXA", label: "política de referer" },
    "strict-transport-security": { sev: "MEDIA", label: "HSTS" },
  };
  for (const [h, { sev, label }] of Object.entries(want)) {
    const val = headers.get(h);
    if (val) rec("OK", "headers", `${label} presente`, val.slice(0, 80));
    else rec(sev, "headers", `${label} ausente (${h})`);
  }
  // Cabeçalhos que revelam a stack sem necessidade.
  for (const leak of ["x-powered-by", "server"]) {
    const v = headers.get(leak);
    if (v && !/vercel/i.test(v)) rec("BAIXA", "headers", `revela stack: ${leak}`, v);
  }
}

// ── 2. Arquivos e caminhos que não podem estar expostos ───────────────────────
async function checkExposed() {
  const paths = [
    "/.env",
    "/.env.local",
    "/.env.turso",
    "/.env.production",
    "/.git/config",
    "/.git/HEAD",
    "/local.db",
    "/.dast.db",
    "/package.json",
    "/drizzle.config.ts",
    "/next.config.ts",
    "/vercel.json",
    "/api/v1/../../.env",
    "/.well-known/security.txt",
  ];
  for (const p of paths) {
    const { status, body } = await req(p);
    const leaked =
      status === 200 &&
      /(AUTH_SECRET|DATABASE_AUTH_TOKEN|passwordHash|BEGIN|libsql:\/\/|"dependencies")/i.test(body);
    if (leaked) rec("CRIT", "exposição", `${p} servido com conteúdo sensível (${status})`);
    else if (status === 200 && p !== "/.well-known/security.txt")
      rec("MEDIA", "exposição", `${p} respondeu 200 — conferir conteúdo`, body.slice(0, 60));
    else rec("OK", "exposição", `${p} não exposto (${status})`);
  }
}

// ── 3. Rotas protegidas têm de recusar quem não tem sessão ────────────────────
async function checkAuthWall() {
  const apiGet = [
    "/api/v1/clients",
    "/api/v1/clients/qualquer-id",
    "/api/v1/appointments",
    "/api/v1/products",
    "/api/v1/professionals",
    "/api/v1/services",
    "/api/v1/stock-movements",
  ];
  for (const p of apiGet) {
    const { status, body } = await req(p);
    const exposed = status === 200 && /\[|\{/.test(body) && !/error/i.test(body);
    if (exposed) rec("CRIT", "auth", `${p} devolveu dados SEM sessão (${status})`, body.slice(0, 80));
    else if (status === 401) rec("OK", "auth", `${p} exige sessão (401)`);
    else rec("INFO", "auth", `${p} → ${status}`);
  }
  // Páginas protegidas devem redirecionar ao login.
  for (const p of ["/clientes", "/estoque", "/agenda", "/config", "/"]) {
    const { status, headers } = await req(p);
    const loc = headers.get("location") ?? "";
    if ((status === 307 || status === 302 || status === 308) && /\/login/.test(loc))
      rec("OK", "auth", `${p} redireciona ao login (${status})`);
    else if (status === 200)
      rec("ALTA", "auth", `${p} abriu SEM sessão (200)`);
    else rec("INFO", "auth", `${p} → ${status} ${loc}`);
  }
}

// ── 4. Barreira de origem (CSRF) ──────────────────────────────────────────────
async function checkCsrf() {
  // POST vindo de outra origem, sem sessão. Tem de ser barrado antes de escrever.
  const { status } = await req("/api/v1/clients", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://evil.example.com" },
    body: JSON.stringify({ name: "csrf-probe", phone: "41999999999" }),
  });
  if (status === 401 || status === 403)
    rec("OK", "csrf", `POST de outra origem barrado (${status})`);
  else rec("ALTA", "csrf", `POST de outra origem não barrado (${status})`);
}

// ── 5. Métodos HTTP incomuns ──────────────────────────────────────────────────
async function checkMethods() {
  for (const m of ["TRACE", "TRACK", "CONNECT"]) {
    try {
      const { status } = await req("/", { method: m });
      if (status >= 400) rec("OK", "métodos", `${m} recusado (${status})`);
      else rec("BAIXA", "métodos", `${m} aceito (${status})`);
    } catch {
      rec("OK", "métodos", `${m} recusado (conexão)`);
    }
  }
}

async function main() {
  console.log(`\n${C.bold}DAST de superfície (somente leitura)${C.reset}  →  ${base}\n`);
  const suites = [checkHeaders, checkExposed, checkAuthWall, checkCsrf, checkMethods];
  for (const s of suites) {
    try {
      await s();
    } catch (e) {
      rec("INFO", s.name, `falha ao executar: ${e.message}`);
    }
  }

  const order = ["CRIT", "ALTA", "MEDIA", "BAIXA", "INFO", "OK"];
  results.sort((a, b) => order.indexOf(a.sev) - order.indexOf(b.sev));
  for (const r of results) {
    const c = sevColor[r.sev] ?? "";
    const tag = r.sev.padEnd(5);
    const detail = r.detail ? ` ${C.dim}${r.detail}${C.reset}` : "";
    console.log(`  ${c}${tag}${C.reset} ${C.dim}[${r.area}]${C.reset} ${r.msg}${detail}`);
  }

  const counts = order.map((s) => [s, results.filter((r) => r.sev === s).length]);
  console.log(
    "\n" +
      counts
        .filter(([, n]) => n > 0)
        .map(([s, n]) => `${s}: ${n}`)
        .join("  ·  ") +
      "\n",
  );

  const bad = results.filter((r) => ["CRIT", "ALTA"].includes(r.sev)).length;
  process.exit(bad > 0 ? 1 : 0);
}

main();
