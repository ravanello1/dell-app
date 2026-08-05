import "./env";
import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { hashPassword } from "@/core/auth/password";
import { users } from "@/modules/auth/user.schema";
import { professionals } from "@/modules/agenda/professional.schema";
import { services } from "@/modules/agenda/service.schema";
import { businessHours } from "@/modules/agenda/schedule.schema";
import { products } from "@/modules/inventory/product.schema";
import { stockMovements } from "@/modules/inventory/stock-movement.schema";

/**
 * Popula um banco vazio com o mínimo para o app ser utilizável: a conta da
 * proprietária, a tabela de procedimentos, o horário de funcionamento e o
 * estoque inicial.
 *
 * É idempotente — rodar de novo não duplica nada, só completa o que faltar.
 */

const SERVICES = [
  { name: "Volume Brasileiro", category: "CILIOS", durationMin: 120, priceCents: 18000 },
  { name: "Volume Russo", category: "CILIOS", durationMin: 150, priceCents: 25000 },
  { name: "Fio a Fio Clássico", category: "CILIOS", durationMin: 120, priceCents: 15000 },
  { name: "Volume Híbrido", category: "CILIOS", durationMin: 130, priceCents: 20000 },
  { name: "Manutenção (até 21 dias)", category: "CILIOS", durationMin: 90, priceCents: 11000 },
  { name: "Remoção de extensão", category: "CILIOS", durationMin: 30, priceCents: 4000 },
  { name: "Lash Lifting", category: "CILIOS", durationMin: 60, priceCents: 13000 },
  { name: "Design de Sobrancelha", category: "SOBRANCELHA", durationMin: 30, priceCents: 5000 },
  { name: "Design com Henna", category: "SOBRANCELHA", durationMin: 45, priceCents: 7000 },
  { name: "Brow Lamination", category: "SOBRANCELHA", durationMin: 60, priceCents: 14000 },
] as const;

const PRODUCTS = [
  { name: "Cílios C 0.07", spec: "11mm", category: "CILIOS", unit: "CX", qty: 6, min: 2, cost: 3500 }, // prettier-ignore
  { name: "Cílios C 0.07", spec: "10mm", category: "CILIOS", unit: "CX", qty: 5, min: 2, cost: 3500 }, // prettier-ignore
  { name: "Cílios D 0.05", spec: "12mm", category: "CILIOS", unit: "CX", qty: 4, min: 2, cost: 3900 }, // prettier-ignore
  { name: "Cílios D 0.05", spec: "9mm", category: "CILIOS", unit: "CX", qty: 3, min: 2, cost: 3900 },
  { name: "Cola para extensão", spec: "5ml · secagem 1s", category: "COLA", unit: "UN", qty: 3, min: 2, cost: 8900 }, // prettier-ignore
  { name: "Primer para cílios", spec: "15ml", category: "PRIMER", unit: "UN", qty: 2, min: 1, cost: 4500 }, // prettier-ignore
  { name: "Selante de cílios", spec: "10ml", category: "PRIMER", unit: "UN", qty: 2, min: 1, cost: 5200 }, // prettier-ignore
  { name: "Removedor em gel", spec: "15g", category: "REMOVEDOR", unit: "UN", qty: 2, min: 1, cost: 4800 }, // prettier-ignore
  { name: "Micropore", spec: "rolo 25mm", category: "DESCARTAVEL", unit: "UN", qty: 8, min: 4, cost: 700 }, // prettier-ignore
  { name: "Pad de hidrogel", spec: "par", category: "DESCARTAVEL", unit: "PAR", qty: 40, min: 20, cost: 250 }, // prettier-ignore
  { name: "Microbrush", spec: "pacote 100un", category: "DESCARTAVEL", unit: "CX", qty: 4, min: 2, cost: 1500 }, // prettier-ignore
  { name: "Escovinha descartável", spec: "pacote 50un", category: "DESCARTAVEL", unit: "CX", qty: 5, min: 2, cost: 1200 }, // prettier-ignore
  { name: "Shampoo para cílios", spec: "60ml", category: "HIGIENE", unit: "UN", qty: 3, min: 2, cost: 2900 }, // prettier-ignore
  { name: "Pinça reta", spec: "aço inox", category: "FERRAMENTA", unit: "UN", qty: 2, min: 1, cost: 6500 }, // prettier-ignore
  { name: "Pinça curva 45°", spec: "aço inox", category: "FERRAMENTA", unit: "UN", qty: 2, min: 1, cost: 6900 }, // prettier-ignore
  { name: "Henna para sobrancelha", spec: "castanho médio", category: "SOBRANCELHA", unit: "UN", qty: 1, min: 1, cost: 3400 }, // prettier-ignore
] as const;

/** Segunda a sexta 9h–19h, sábado 9h–16h. Domingo fechado. */
const HOURS = [
  { weekday: 1, open: 9 * 60, close: 19 * 60 },
  { weekday: 2, open: 9 * 60, close: 19 * 60 },
  { weekday: 3, open: 9 * 60, close: 19 * 60 },
  { weekday: 4, open: 9 * 60, close: 19 * 60 },
  { weekday: 5, open: 9 * 60, close: 19 * 60 },
  { weekday: 6, open: 9 * 60, close: 16 * 60 },
];

async function main() {
  console.log("→ Preparando os dados iniciais do Dell App…\n");

  // ── Proprietária ──────────────────────────────────────────────────────────
  const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? "").trim().toLowerCase();
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "";
  const ownerName = process.env.SEED_OWNER_NAME ?? "Dell";

  if (!ownerEmail || !ownerPassword) {
    throw new Error(
      "Defina SEED_OWNER_EMAIL e SEED_OWNER_PASSWORD no .env.local antes de rodar o seed.",
    );
  }
  if (ownerPassword.length < 8) {
    throw new Error("SEED_OWNER_PASSWORD precisa de pelo menos 8 caracteres.");
  }

  let [owner] = await db.select().from(users).where(eq(users.email, ownerEmail)).limit(1);

  if (!owner) {
    [owner] = await db
      .insert(users)
      .values({
        name: ownerName,
        email: ownerEmail,
        passwordHash: await hashPassword(ownerPassword),
        role: "OWNER",
      })
      .returning();
    console.log(`  ✓ Usuária criada: ${ownerEmail}`);
  } else {
    console.log(`  · Usuária já existia: ${ownerEmail}`);
  }
  if (!owner) throw new Error("Não foi possível criar a usuária proprietária.");

  // ── Profissional ──────────────────────────────────────────────────────────
  const existingProfessionals = await db.select().from(professionals).limit(1);
  let professionalId = existingProfessionals[0]?.id;

  if (!professionalId) {
    const [professional] = await db
      .insert(professionals)
      .values({ userId: owner.id, name: ownerName, color: "#c9a227", sortOrder: 0 })
      .returning();
    professionalId = professional?.id;
    console.log(`  ✓ Profissional criada: ${ownerName}`);
  } else {
    console.log("  · Profissional já cadastrada");
  }

  // ── Procedimentos ─────────────────────────────────────────────────────────
  const existingServices = await db.select({ name: services.name }).from(services);
  const knownServices = new Set(existingServices.map((row) => row.name));
  const newServices = SERVICES.filter((service) => !knownServices.has(service.name));

  if (newServices.length > 0) {
    await db.insert(services).values(
      newServices.map((service, index) => ({
        name: service.name,
        category: service.category,
        durationMin: service.durationMin,
        priceCents: service.priceCents,
        color: service.category === "CILIOS" ? "#be3f6c" : "#c9a227",
        sortOrder: index,
      })),
    );
  }
  console.log(`  ✓ Procedimentos: ${newServices.length} novos, ${knownServices.size} já existiam`);

  // ── Horário de funcionamento ──────────────────────────────────────────────
  const existingHours = await db.select({ id: businessHours.id }).from(businessHours).limit(1);
  if (existingHours.length === 0) {
    await db.insert(businessHours).values(
      HOURS.map((hour) => ({
        weekday: hour.weekday,
        openMinute: hour.open,
        closeMinute: hour.close,
      })),
    );
    console.log("  ✓ Horário de funcionamento definido (seg–sex 9h–19h, sáb 9h–16h)");
  } else {
    console.log("  · Horário de funcionamento já definido");
  }

  // ── Estoque inicial ───────────────────────────────────────────────────────
  const existingProducts = await db
    .select({ name: products.name, spec: products.spec })
    .from(products);
  const knownProducts = new Set(existingProducts.map((row) => `${row.name}|${row.spec ?? ""}`));

  let created = 0;
  for (const item of PRODUCTS) {
    if (knownProducts.has(`${item.name}|${item.spec}`)) continue;

    const [product] = await db
      .insert(products)
      .values({
        name: item.name,
        spec: item.spec,
        category: item.category,
        unit: item.unit,
        currentQty: item.qty,
        minQty: item.min,
        costCents: item.cost,
      })
      .returning();

    // A quantidade inicial entra como movimento, não como número solto: o
    // extrato do produto começa coerente com o saldo desde o primeiro dia.
    if (product) {
      await db.insert(stockMovements).values({
        productId: product.id,
        type: "IN",
        qtyDelta: item.qty,
        balanceAfter: item.qty,
        reason: "Estoque inicial",
        unitCostCents: item.cost,
        userId: owner.id,
      });
      created += 1;
    }
  }
  console.log(`  ✓ Estoque: ${created} produtos novos, ${knownProducts.size} já existiam`);

  console.log("\n✓ Pronto. Entre com:");
  console.log(`    e-mail: ${ownerEmail}`);
  console.log(`    senha:  a que está em SEED_OWNER_PASSWORD no .env.local\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n✗ Falha no seed:", error);
    process.exit(1);
  });
