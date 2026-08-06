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
  auth: typeof import("@/modules/auth/auth.service");
  anamnese: typeof import("@/modules/anamnese/anamnese.service");
  marketing: typeof import("@/modules/marketing/marketing.service");
  eq: typeof import("drizzle-orm").eq;
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
    auth: await import("@/modules/auth/auth.service"),
    anamnese: await import("@/modules/anamnese/anamnese.service"),
    marketing: await import("@/modules/marketing/marketing.service"),
    eq: (await import("drizzle-orm")).eq,
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

describe("sessão: o cookie prova identidade, o banco decide permissão", () => {
  /**
   * O token de sessão vale 30 dias e carrega o papel congelado no momento do
   * login. Se a autorização confiasse só nele, desativar alguém ou rebaixar seu
   * papel não teria efeito nenhum até o token vencer. Estes três testes cobrem
   * exatamente isso.
   */

  it("resolve o usuário quando ele existe e está ativo", async () => {
    const resolved = await m.auth.resolveSessionUser(owner.id);
    expect(resolved).not.toBeNull();
    expect(resolved?.email).toBe(owner.email);
    expect(resolved?.role).toBe("OWNER");
  });

  it("recusa a sessão de quem foi desativado", async () => {
    const [desativada] = await m.db
      .insert(m.schema.users)
      .values({
        name: "Ex-funcionária",
        email: "saiu@dellbeautystudio.com.br",
        passwordHash: "x",
        role: "RECEPTION",
        active: false,
      })
      .returning();

    expect(await m.auth.resolveSessionUser(desativada!.id)).toBeNull();
  });

  it("devolve o papel atual do banco, não o que estava no token", async () => {
    const [promovida] = await m.db
      .insert(m.schema.users)
      .values({
        name: "Promovida",
        email: "promovida@dellbeautystudio.com.br",
        passwordHash: "x",
        role: "RECEPTION",
      })
      .returning();

    // O token dela diria RECEPTION para sempre; o banco passa a dizer OWNER.
    await m.db
      .update(m.schema.users)
      .set({ role: "OWNER" })
      .where(m.eq(m.schema.users.id, promovida!.id));

    expect((await m.auth.resolveSessionUser(promovida!.id))?.role).toBe("OWNER");
  });

  it("recusa a sessão de quem não existe neste banco", async () => {
    // O caso do token assinado com o segredo de outro ambiente.
    expect(await m.auth.resolveSessionUser(crypto.randomUUID())).toBeNull();
  });
});

describe("anamnese: rascunho vira documento e congela", () => {
  /**
   * As três regras que sustentam a ficha: só quem é do clínico acessa, ficha
   * assinada não muda mais, e assinar congela a identidade de quem assinou.
   */
  const PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const pro: SessionUser = { ...owner, id: "user-pro-anamnese", role: "PRO" };
  const reception: SessionUser = { ...owner, id: "user-recep-anamnese", role: "RECEPTION" };

  // A profissional precisa existir de verdade: `createdBy` da ficha aponta para
  // ela e há chave estrangeira para `users`.
  beforeAll(async () => {
    await m.db.insert(m.schema.users).values({
      id: pro.id,
      name: pro.name,
      email: "pro-anamnese@dellbeautystudio.com.br",
      passwordHash: "x",
      role: "PRO",
    });
  });

  it("recepção não acessa nem cria fichas", async () => {
    await expect(m.anamnese.listByClient(clientId, reception)).rejects.toThrow();
    await expect(m.anamnese.createForClient(clientId, "CILIOS", reception)).rejects.toThrow();
  });

  it("não abre dois rascunhos soltos para a mesma cliente", async () => {
    const first = await m.anamnese.createForClient(clientId, "CILIOS", owner);
    const second = await m.anamnese.createForClient(clientId, "CILIOS", owner);
    expect(second.id).toBe(first.id);
    expect(first.status).toBe("DRAFT");
  });

  it("assinar exige as duas assinaturas e congela a identidade", async () => {
    const draft = await m.anamnese.createForClient(clientId, "LASH_LIFTING", pro);

    const signed = await m.anamnese.sign(
      draft.id,
      {
        answers: { gestante: { value: true, detail: "20 semanas" } },
        clientSignature: PNG,
        professionalSignature: PNG,
      },
      pro,
    );

    expect(signed.status).toBe("SIGNED");
    expect(signed.signedAt).not.toBeNull();
    // Identidade da responsável técnica congelada no documento.
    expect(signed.snapshot?.professional.document).toBe("61.418.546/0001-51");
    expect(signed.snapshot?.client.name).toBeTruthy();
  });

  it("ficha assinada é imutável — nem editar, nem reassinar, nem descartar", async () => {
    const draft = await m.anamnese.createForClient(clientId, "CILIOS", owner);
    const signed = await m.anamnese.sign(
      draft.id,
      { clientSignature: PNG, professionalSignature: PNG },
      owner,
    );

    await expect(
      m.anamnese.saveDraft(signed.id, { observations: "mudança" }, owner),
    ).rejects.toThrow();
    await expect(
      m.anamnese.sign(signed.id, { clientSignature: PNG, professionalSignature: PNG }, owner),
    ).rejects.toThrow();
    await expect(m.anamnese.discardDraft(signed.id, owner)).rejects.toThrow();
  });
});

describe("anamnese: link público (preenchimento remoto)", () => {
  /**
   * A cliente preenche por um link com token, sem login; a profissional
   * contra-assina depois. O token dá acesso a UMA ficha e só a ela, expira, e
   * morre quando a ficha é assinada.
   */
  const PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const pro: SessionUser = { ...owner, id: "user-pro-anamnese", role: "PRO" };

  it("gera link, a cliente envia, e a profissional contra-assina", async () => {
    const draft = await m.anamnese.createForClient(clientId, "HENNA", owner);
    const { token, client } = await m.anamnese.createPublicLink(draft.id, owner);
    expect(token.length).toBeGreaterThan(30);
    expect(client.name).toBeTruthy();

    // A cliente abre o link: vê a ficha dela, preenchível.
    const publicView = await m.anamnese.getPublicByToken(token);
    expect(publicView.state).toBe("FILLABLE");
    expect(publicView.procedure).toBe("HENNA");
    expect(publicView.clientFirstName).toBe("Camila");

    // Envia respostas + assinatura dela.
    await m.anamnese.submitPublicByToken(token, {
      answers: { gestante: { value: false, detail: "" } },
      observations: "enviado de casa",
      clientSignature: PNG,
    });

    // Agora está aguardando a profissional; reenvio é recusado.
    expect((await m.anamnese.getPublicByToken(token)).state).toBe("SUBMITTED");
    await expect(
      m.anamnese.submitPublicByToken(token, {
        answers: {},
        clientSignature: PNG,
      }),
    ).rejects.toThrow();

    // A profissional contra-assina com SÓ a assinatura dela (usa a da cliente já guardada).
    const signed = await m.anamnese.sign(draft.id, { professionalSignature: PNG }, pro);
    expect(signed.status).toBe("SIGNED");

    // O link morre depois de assinada.
    await expect(m.anamnese.getPublicByToken(token)).rejects.toThrow();
  });

  it("recusa token desconhecido", async () => {
    await expect(m.anamnese.getPublicByToken("token-que-nao-existe")).rejects.toThrow();
  });

  it("recusa link expirado", async () => {
    const draft = await m.anamnese.createForClient(clientId, "LASH_LIFTING", owner);
    const { token } = await m.anamnese.createPublicLink(draft.id, owner);

    // Força a expiração no passado.
    const hash = (await import("@/modules/anamnese/anamnese.token")).hashAnamneseToken(token);
    await m.db
      .update(m.schema.anamneseForms)
      .set({ publicTokenExpiresAt: new Date(Date.now() - 1000) })
      .where(m.eq(m.schema.anamneseForms.publicTokenHash, hash));

    expect((await m.anamnese.getPublicByToken(token)).state).toBe("EXPIRED");
    await expect(
      m.anamnese.submitPublicByToken(token, { answers: {}, clientSignature: PNG }),
    ).rejects.toThrow();
  });

  it("recepção não gera link (dado clínico)", async () => {
    const draft = await m.anamnese.createForClient(clientId, "BROW_LAMINATION", owner);
    const reception: SessionUser = { ...owner, id: "user-recep-anamnese", role: "RECEPTION" };
    await expect(m.anamnese.createPublicLink(draft.id, reception)).rejects.toThrow();
  });
});

describe("marketing: grupos e promoções", () => {
  it("monta os grupos e enxerga a cliente na base", async () => {
    const data = await m.marketing.getMarketingData();
    expect(Array.isArray(data.all)).toBe(true);
    expect(data.all.some((c) => c.name.includes("Camila"))).toBe(true);
    expect(typeof data.nowMs).toBe("number");
  });

  it("aniversariante do mês entra no grupo de aniversários", async () => {
    // Cria uma cliente cujo aniversário cai no mês corrente.
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const created = await m.clients.createClient(
      m.clientDto.createClientSchema.parse({
        name: "Aniversariante do Mês",
        phone: "41999990000",
        birthDate: `1995-${mm}-15`,
        lgpdConsent: true,
      }),
      owner,
    );

    const data = await m.marketing.getMarketingData();
    const found = data.birthdays.find((c) => c.id === created.id);
    expect(found).toBeTruthy();
    expect(found?.birthdayDay).toBe(15);
  });

  it("cria, edita e remove uma promoção", async () => {
    const promo = await m.marketing.createPromotion(
      { title: "Julho da amiga", message: "Oi, {nome}! Traga uma amiga.", active: true },
      owner,
    );
    expect(promo.title).toBe("Julho da amiga");

    const edited = await m.marketing.updatePromotion(promo.id, { title: "Agosto da amiga" });
    expect(edited.title).toBe("Agosto da amiga");
    expect(edited.message).toContain("{nome}"); // mensagem preservada

    await m.marketing.deletePromotion(promo.id);
    expect((await m.marketing.listPromotions()).find((p) => p.id === promo.id)).toBeUndefined();
  });
});
