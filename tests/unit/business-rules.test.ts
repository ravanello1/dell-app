import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/core/auth/session";

/**
 * As duas regras que sustentam o sistema, exercitadas contra um SQLite de
 * verdade — e não contra dublês.
 *
 * Ambas dependem de estado no banco (o que já existe na agenda, o saldo
 * acumulado do razão), e um dublê só provaria que o dublê funciona. O banco de
 * teste é um arquivo próprio, recriado do zero a cada execução.
 */

const TEST_DB = "./.test.db";

process.env.DATABASE_URL = `file:${TEST_DB}`;
process.env.AUTH_SECRET = "segredo-de-teste-com-tamanho-mais-que-suficiente-aqui";

const owner: SessionUser = {
  id: "user-teste",
  name: "Dell",
  email: "teste@dellbeautystudio.com.br",
  role: "OWNER",
};

/** Importados depois que a env está posta — o módulo de banco lê no import. */
type Modules = {
  db: typeof import("@/core/db").db;
  schema: typeof import("@/core/db/schema");
  agenda: typeof import("@/modules/agenda/agenda.service");
  agendaDto: typeof import("@/modules/agenda/agenda.dto");
  inventory: typeof import("@/modules/inventory/inventory.service");
  inventoryDto: typeof import("@/modules/inventory/inventory.dto");
  clients: typeof import("@/modules/clients/client.service");
  clientDto: typeof import("@/modules/clients/client.dto");
  errors: typeof import("@/core/api/errors");
};

let m: Modules;
let clientId: string;
let serviceId: string;
let professionalId: string;

beforeAll(async () => {
  for (const suffix of ["", "-shm", "-wal"]) {
    const path = `${TEST_DB}${suffix}`;
    if (existsSync(path)) rmSync(path);
  }
  execSync("npx tsx scripts/migrate.ts", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB}` },
  });

  m = {
    db: (await import("@/core/db")).db,
    schema: await import("@/core/db/schema"),
    agenda: await import("@/modules/agenda/agenda.service"),
    agendaDto: await import("@/modules/agenda/agenda.dto"),
    inventory: await import("@/modules/inventory/inventory.service"),
    inventoryDto: await import("@/modules/inventory/inventory.dto"),
    clients: await import("@/modules/clients/client.service"),
    clientDto: await import("@/modules/clients/client.dto"),
    errors: await import("@/core/api/errors"),
  };

  await m.db.insert(m.schema.users).values({
    id: owner.id,
    name: owner.name,
    email: owner.email,
    passwordHash: "x",
    role: "OWNER",
  });

  const client = await m.clients.createClient(
    m.clientDto.createClientSchema.parse({
      name: "Camila Ferraz",
      phone: "41988776655",
      lgpdConsent: true,
    }),
    owner,
  );
  clientId = client.id;

  const service = await m.agenda.createService(
    m.agendaDto.createServiceSchema.parse({
      name: "Volume Brasileiro",
      durationMin: 120,
      priceCents: 18000,
    }),
  );
  serviceId = service.id;

  const professional = await m.agenda.createProfessional(
    m.agendaDto.createProfessionalSchema.parse({ name: "Dell" }),
  );
  professionalId = professional.id;
}, 60_000);

const at = (time: string) => `2026-09-15T${time}:00.000Z`;

async function marcar(startAt: string, options?: { status?: string }) {
  return m.agenda.createAppointment(
    m.agendaDto.createAppointmentSchema.parse({
      clientId,
      serviceId,
      professionalId,
      startAt,
      ...(options?.status && { status: options.status }),
    }),
    owner,
  );
}

describe("agenda: uma profissional não fica em dois lugares ao mesmo tempo", () => {
  it("calcula o fim a partir da duração do procedimento", async () => {
    const appointment = await marcar(at("12:00"));
    // 12:00 + 120min
    expect(appointment.endAt).toBe(at("14:00"));
    expect(appointment.priceCents).toBe(18000); // preço copiado do procedimento
  });

  it("recusa horário que cai dentro de outro atendimento", async () => {
    await expect(marcar(at("13:00"))).rejects.toThrow();

    try {
      await marcar(at("13:00"));
    } catch (error) {
      expect(m.errors.isAppError(error)).toBe(true);
      if (m.errors.isAppError(error)) {
        expect(error.status).toBe(409);
        // A mensagem diz com quem colide — é o que a recepção precisa saber.
        expect(error.message).toContain("Camila Ferraz");
        expect(error.fields?.startAt).toBeDefined();
      }
    }
  });

  it("aceita horário que encosta no anterior sem invadir", async () => {
    // O de 12:00 termina às 14:00; começar exatamente às 14:00 é válido.
    const appointment = await marcar(at("14:00"));
    expect(appointment.startAt).toBe(at("14:00"));
  });

  it("libera o horário quando o atendimento é cancelado", async () => {
    const original = await marcar(at("18:00"));
    await expect(marcar(at("18:30"))).rejects.toThrow();

    await m.agenda.updateAppointment(original.id, { status: "CANCELED" });

    // Cancelado não ocupa mais a grade.
    const reused = await marcar(at("18:30"));
    expect(reused.id).not.toBe(original.id);
  });

  it("ao remarcar, não colide consigo mesmo", async () => {
    const appointment = await marcar(at("21:00"));
    const moved = await m.agenda.updateAppointment(appointment.id, {
      startAt: new Date(at("21:30")),
    });
    expect(moved.startAt).toBe(at("21:30"));
    // A duração original foi preservada ao arrastar.
    expect(moved.endAt).toBe(at("23:30"));
  });
});

describe("estoque: o razão é a verdade", () => {
  let productId: string;

  it("a quantidade inicial entra como movimento", async () => {
    const product = await m.inventory.createProduct(
      m.inventoryDto.createProductSchema.parse({
        name: "Cola para extensão",
        unit: "UN",
        initialQty: 3,
        minQty: 2,
        costCents: 8900,
      }),
      owner,
    );
    productId = product.id;

    expect(product.currentQty).toBe(3);

    const movements = await m.inventory.listMovements(productId);
    expect(movements).toHaveLength(1);
    expect(movements[0]?.type).toBe("IN");
    expect(movements[0]?.balanceAfter).toBe(3);
  });

  it("saída reduz o saldo e dispara o alerta de mínimo", async () => {
    const product = await m.inventory.registerMovement(
      m.inventoryDto.createMovementSchema.parse({ productId, type: "OUT", quantity: 1 }),
      owner,
    );
    expect(product.currentQty).toBe(2);
    expect(product.isLow).toBe(true); // saldo igual ao mínimo já pede reposição
  });

  it("recusa saída que deixaria o saldo negativo", async () => {
    try {
      await m.inventory.registerMovement(
        m.inventoryDto.createMovementSchema.parse({ productId, type: "OUT", quantity: 99 }),
        owner,
      );
      throw new Error("deveria ter recusado");
    } catch (error) {
      expect(m.errors.isAppError(error)).toBe(true);
      if (m.errors.isAppError(error)) {
        expect(error.status).toBe(409);
        // A mensagem indica a saída: usar o ajuste de inventário.
        expect(error.message).toContain("Ajuste de inventário");
      }
    }
  });

  it("ajuste define o saldo contado, não a variação", async () => {
    // Saldo era 2; a contagem achou 5 → o razão registra +3.
    const product = await m.inventory.registerMovement(
      m.inventoryDto.createMovementSchema.parse({
        productId,
        type: "ADJUST",
        quantity: 5,
        reason: "Contagem do mês",
      }),
      owner,
    );
    expect(product.currentQty).toBe(5);

    const [latest] = await m.inventory.listMovements(productId);
    expect(latest?.type).toBe("ADJUST");
    expect(latest?.qtyDelta).toBe(3);
    expect(latest?.balanceAfter).toBe(5);
  });

  it("o saldo em cache bate com a soma do razão", async () => {
    const result = await m.inventory.reconcileProduct(productId, owner);
    expect(result.corrected).toBe(false);
    expect(result.before).toBe(result.after);
  });

  it("recusa movimento que não altera nada", async () => {
    await expect(
      m.inventory.registerMovement(
        m.inventoryDto.createMovementSchema.parse({ productId, type: "ADJUST", quantity: 5 }),
        owner,
      ),
    ).rejects.toThrow();
  });

  it("perda também baixa o saldo", async () => {
    const product = await m.inventory.registerMovement(
      m.inventoryDto.createMovementSchema.parse({
        productId,
        type: "LOSS",
        quantity: 1,
        reason: "Frasco quebrou",
      }),
      owner,
    );
    expect(product.currentQty).toBe(4);
  });
});

describe("clientes: uma pessoa, uma ficha", () => {
  it("recusa telefone já cadastrado, dizendo de quem é", async () => {
    try {
      await m.clients.createClient(
        m.clientDto.createClientSchema.parse({ name: "Outra Pessoa", phone: "(41) 98877-6655" }),
        owner,
      );
      throw new Error("deveria ter recusado");
    } catch (error) {
      expect(m.errors.isAppError(error)).toBe(true);
      if (m.errors.isAppError(error)) {
        expect(error.status).toBe(409);
        expect(error.message).toContain("Camila Ferraz");
        expect(error.fields?.phone).toBeDefined();
      }
    }
  });

  it("esconde observações de saúde da recepção", async () => {
    await m.clients.updateClient(clientId, { healthNotes: "Alergia a cianoacrilato" }, owner);

    const forOwner = await m.clients.getClient(clientId, owner);
    expect(forOwner.healthNotes).toBe("Alergia a cianoacrilato");

    const reception: SessionUser = { ...owner, role: "RECEPTION" };
    const forReception = await m.clients.getClient(clientId, reception);
    expect(forReception.healthNotes).toBeUndefined();
  });

  it("registra a data do consentimento LGPD", async () => {
    const client = await m.clients.getClient(clientId, owner);
    expect(client.hasLgpdConsent).toBe(true);
    expect(client.lgpdConsentAt).not.toBeNull();
  });

  it("só a proprietária apaga dados em definitivo", async () => {
    const reception: SessionUser = { ...owner, role: "RECEPTION" };
    await expect(m.clients.eraseClient(clientId, reception)).rejects.toThrow();
  });
});
