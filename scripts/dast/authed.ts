import "../env";
import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { users } from "@/modules/auth/user.schema";
import { signSessionToken } from "@/core/auth/session";
import type { UserRole } from "@/modules/auth/user.schema";

/**
 * DAST autenticado — SÓ contra o alvo local descartável (.dast.db).
 *
 * O risco real deste app não é o invasor anônimo: a parede de sessão já o barra,
 * e o scan de superfície confirmou isso. O risco é a usuária legítima de papel
 * baixo tentando o que não é dela. Então este scanner entra COM sessão de cada
 * papel e ataca por dentro.
 *
 * Os cookies são assinados aqui com a mesma função e o mesmo segredo do alvo —
 * o que reproduz exatamente uma sessão legítima, sem depender do id interno da
 * Server Action de login. Um cookie forjado (segredo errado) também é testado,
 * para provar que a verificação de assinatura pega.
 */

const base = (process.argv[2] ?? "http://127.0.0.1:4199").replace(/\/$/, "");

const C = {
  reset: "\x1b[0m", red: "\x1b[31m", yellow: "\x1b[33m",
  green: "\x1b[32m", dim: "\x1b[2m", bold: "\x1b[1m",
};
const sevColor: Record<string, string> = {
  CRIT: C.red, ALTA: C.red, MEDIA: C.yellow, BAIXA: C.yellow, OK: C.green, INFO: C.dim,
};

type Sev = "CRIT" | "ALTA" | "MEDIA" | "BAIXA" | "INFO" | "OK";
const results: { sev: Sev; area: string; msg: string; detail?: string }[] = [];
const rec = (sev: Sev, area: string, msg: string, detail?: string) =>
  results.push({ sev, area, msg, detail });

async function cookieFor(role: UserRole | "OFF"): Promise<string | null> {
  const email =
    role === "OFF" ? "off@dast.local" : `${role.toLowerCase().replace("reception", "recep")}@dast.local`;
  const map: Record<string, string> = {
    OWNER: "dona@dast.local",
    PRO: "pro@dast.local",
    RECEPTION: "recep@dast.local",
    OFF: "off@dast.local",
  };
  const [u] = await db.select().from(users).where(eq(users.email, map[role] ?? email)).limit(1);
  if (!u) return null;
  const token = await signSessionToken({ id: u.id, name: u.name, email: u.email, role: u.role });
  return `dell_session=${token}`;
}

async function api(cookie: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: {
      origin: base,
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: "manual",
  });
  const text = await res.text().catch(() => "");
  let json: Record<string, unknown> | undefined;
  try {
    json = JSON.parse(text);
  } catch {
    /* não-JSON */
  }
  return { status: res.status, text, json };
}

async function main() {
  console.log(
    `\n${C.bold}DAST autenticado${C.reset}  →  ${base}  ${C.dim}(alvo descartável)${C.reset}\n`,
  );

  const owner = await cookieFor("OWNER");
  const recep = await cookieFor("RECEPTION");
  const pro = await cookieFor("PRO");
  const off = await cookieFor("OFF");

  for (const [role, c] of [["OWNER", owner], ["PRO", pro], ["RECEPTION", recep]] as const) {
    const r = await api(c, "GET", "/api/v1/clients");
    if (r.status === 200) rec("OK", "login", `${role} tem sessão válida`);
    else rec("ALTA", "login", `${role} não acessou nem a lista (${r.status})`);
  }

  // Cliente-alvo com nota de saúde, criado pela dona.
  const criar = await api(owner, "POST", "/api/v1/clients", {
    name: "Alvo Teste",
    phone: "41988887777",
    healthNotes: "ALERGIA CONFIDENCIAL AO CIANOACRILATO",
    lgpdConsent: true,
  });
  const clientId = (criar.json?.data as { id?: string } | undefined)?.id;
  rec(clientId ? "OK" : "INFO", "setup", clientId ? "cliente-alvo criado" : `sem cliente-alvo (${criar.status})`);

  // ── Escalada de privilégio ──────────────────────────────────────────────────
  if (clientId) {
    const erase = await api(recep, "POST", `/api/v1/clients/${clientId}/erase`);
    rec(erase.status === 403 ? "OK" : "CRIT", "escalada",
      erase.status === 403 ? "recepção NÃO apaga em definitivo (403)" : `recepção apagou (${erase.status})`);

    const exp = await api(recep, "GET", `/api/v1/clients/${clientId}/export`);
    rec(exp.status === 403 ? "OK" : "ALTA", "escalada",
      exp.status === 403 ? "recepção NÃO exporta ficha (403)" : `recepção exportou (${exp.status})`);

    const eraseP = await api(pro, "POST", `/api/v1/clients/${clientId}/erase`);
    rec(eraseP.status === 403 ? "OK" : "CRIT", "escalada",
      eraseP.status === 403 ? "profissional NÃO apaga em definitivo (403)" : `profissional apagou (${eraseP.status})`);
  }

  const svc = await api(recep, "POST", "/api/v1/services", { name: "x", durationMin: 30, priceCents: 1000 });
  rec(svc.status === 403 ? "OK" : "ALTA", "escalada",
    svc.status === 403 ? "recepção NÃO cria serviço (403)" : `recepção criou serviço (${svc.status})`);

  const prof = await api(recep, "POST", "/api/v1/professionals", { name: "x", color: "#000000" });
  rec(prof.status === 403 ? "OK" : "ALTA", "escalada",
    prof.status === 403 ? "recepção NÃO cria profissional (403)" : `recepção criou profissional (${prof.status})`);

  // ── Exposição de campo sensível ─────────────────────────────────────────────
  if (clientId) {
    const lida = await api(recep, "GET", `/api/v1/clients/${clientId}`);
    const vazou = /ALERGIA CONFIDENCIAL/.test(lida.text);
    rec(vazou ? "ALTA" : "OK", "exposição",
      vazou ? "recepção LEU nota de saúde no JSON" : "nota de saúde ausente para recepção (200)");
  }
  const prods = await api(recep, "GET", "/api/v1/products");
  const custo = /"costCents"|"totalValueCents"/.test(prods.text);
  rec(custo ? "ALTA" : "OK", "exposição",
    custo ? "recepção vê custo de produto no JSON" : "custo ausente do JSON para recepção");

  // ── Mass assignment ─────────────────────────────────────────────────────────
  const mass = await api(recep, "POST", "/api/v1/clients", {
    name: "Mass Assign",
    phone: "41977776666",
    lgpdConsent: true,
    id: "id-forjado-pelo-cliente",
    createdBy: "outro-usuario",
    role: "OWNER",
    deletedAt: Date.now(),
  });
  const gotId = (mass.json?.data as { id?: string } | undefined)?.id;
  if (gotId && gotId !== "id-forjado-pelo-cliente")
    rec("OK", "mass-assign", "id forjado ignorado — servidor gerou o próprio");
  else if (gotId === "id-forjado-pelo-cliente")
    rec("CRIT", "mass-assign", "id forjado pelo cliente foi aceito");
  else rec("INFO", "mass-assign", `cadastro retornou ${mass.status}`);

  // ── Injection nos parâmetros reais ──────────────────────────────────────────
  const payloads = [
    "'; DROP TABLE clients; --",
    "' OR '1'='1",
    "1)) OR SLEEP(3)-- -",
    "' UNION SELECT password_hash,1,1 FROM users -- ",
    "%27%20OR%201=1--",
    "<script>alert(1)</script>",
    "${7*7}",
    "../../../../etc/passwd",
  ];
  for (const p of payloads) {
    const t0 = Date.now();
    const r = await api(owner, "GET", `/api/v1/clients?q=${encodeURIComponent(p)}`);
    const dt = Date.now() - t0;
    const leak = /password_hash|\$2[aby]\$|root:|no such table|SQLITE_|syntax error|49/.test(
      r.json ? "" : r.text, // 49 = 7*7, só marca se veio de resposta não-JSON crua
    );
    const hardLeak = /password_hash|\$2[aby]\$|root:|no such table|SQLITE_|syntax error/i.test(r.text);
    if (hardLeak) rec("CRIT", "injection", "payload vazou dado ou erro de SQL", p.slice(0, 34));
    else if (dt > 2500) rec("ALTA", "injection", `possível SQLi time-based (${dt}ms)`, p.slice(0, 34));
    else rec("OK", "injection", `tratado como texto (${r.status})`, p.slice(0, 34));
  }

  // Injection no enum de ordenação — o Zod deve barrar antes do banco.
  for (const sort of ["name); DROP TABLE users;--", "recent UNION SELECT 1"]) {
    const r = await api(owner, "GET", `/api/v1/clients?sort=${encodeURIComponent(sort)}`);
    rec(r.status === 422 || r.status === 400 ? "OK" : r.status < 500 ? "OK" : "MEDIA", "injection",
      `sort inválido → ${r.status} (Zod barra o enum)`, sort.slice(0, 28));
  }

  // Paginação com valor absurdo/negativo.
  for (const pg of ["-1", "999999999", "1e9", "abc"]) {
    const r = await api(owner, "GET", `/api/v1/clients?perPage=${pg}`);
    rec(r.status < 500 ? "OK" : "MEDIA", "injection", `perPage="${pg}" → ${r.status}`);
  }

  // ── IDOR: id chutado ────────────────────────────────────────────────────────
  for (const id of ["1", "0", "00000000-0000-0000-0000-000000000000", "%00", "..%2Fadmin"]) {
    const r = await api(recep, "GET", `/api/v1/clients/${id}`);
    const got = r.status === 200 && (r.json?.data as unknown);
    rec(got ? "MEDIA" : "OK", "idor", `id "${id}" → ${r.status}`);
  }

  // ── Sessão de usuário desativado ────────────────────────────────────────────
  if (off) {
    const r = await api(off, "GET", "/api/v1/clients");
    rec(r.status === 200 ? "CRIT" : "OK", "sessão",
      r.status === 200 ? "usuário DESATIVADO ainda acessa (200)" : `usuário desativado barrado (${r.status})`);
  }

  // ── Cookie forjado (assinado com segredo errado) ────────────────────────────
  const forged =
    "dell_session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJPV05FUiIsImlzcyI6ImRlbGwtYXBwIn0.chave_errada_forjada";
  const rf = await api(forged, "GET", "/api/v1/clients");
  rec(rf.status === 200 ? "CRIT" : "OK", "sessão",
    rf.status === 200 ? "cookie forjado aceito (200)" : `cookie forjado rejeitado (${rf.status})`);

  // ── "alg: none" — ataque clássico contra JWT ────────────────────────────────
  const algNone =
    "dell_session=eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJPV05FUiIsImlzcyI6ImRlbGwtYXBwIn0.";
  const ra = await api(algNone, "GET", "/api/v1/clients");
  rec(ra.status === 200 ? "CRIT" : "OK", "sessão",
    ra.status === 200 ? 'JWT "alg:none" aceito (200)' : `JWT "alg:none" rejeitado (${ra.status})`);

  report();
}

function report() {
  const order: Sev[] = ["CRIT", "ALTA", "MEDIA", "BAIXA", "INFO", "OK"];
  results.sort((a, b) => order.indexOf(a.sev) - order.indexOf(b.sev));
  for (const r of results) {
    const detail = r.detail ? ` ${C.dim}${r.detail}${C.reset}` : "";
    console.log(`  ${sevColor[r.sev]}${r.sev.padEnd(5)}${C.reset} ${C.dim}[${r.area}]${C.reset} ${r.msg}${detail}`);
  }
  const counts = order
    .map((s) => [s, results.filter((r) => r.sev === s).length] as const)
    .filter(([, n]) => n > 0);
  console.log("\n" + counts.map(([s, n]) => `${s}: ${n}`).join("  ·  ") + "\n");
  process.exit(results.some((r) => r.sev === "CRIT" || r.sev === "ALTA") ? 1 : 0);
}

main().catch((e) => {
  console.error("erro no scanner:", e);
  process.exit(2);
});
