import { describe, expect, it } from "vitest";
import { createClientSchema, updateClientSchema } from "@/modules/clients/client.dto";
import {
  createMovementSchema,
  createProductSchema,
  updateProductSchema,
} from "@/modules/inventory/inventory.dto";
import { answersSchema, signAnamneseSchema } from "@/modules/anamnese/anamnese.dto";
import {
  createAppointmentSchema,
  createServiceSchema,
  updateAppointmentSchema,
  updateProfessionalSchema,
  updateServiceSchema,
} from "@/modules/agenda/agenda.dto";

/**
 * Regressão de uma classe de bug que apaga dados em silêncio.
 *
 * Num PATCH, campo AUSENTE tem de significar "não mexa nisso". Duas armadilhas
 * do Zod faziam o contrário: `.nullish().transform()` convertia ausência em
 * `null`, e `.partial()` mantinha os `.default()` ativos. Na prática, salvar só
 * o status de um agendamento apagava as observações, e renomear um procedimento
 * resetava a cor — sem ninguém pedir.
 */
describe("PATCH parcial não pode apagar o que não foi enviado", () => {
  it("agendamento: só o status enviado, só o status alterado", () => {
    const result = updateAppointmentSchema.parse({ status: "CANCELED" });
    expect(result).toEqual({ status: "CANCELED" });
    expect("notes" in result).toBe(false);
    expect("cancelReason" in result).toBe(false);
  });

  it("agendamento: string vazia limpa o campo de propósito", () => {
    expect(updateAppointmentSchema.parse({ notes: "" })).toEqual({ notes: null });
  });

  it("procedimento: renomear não reaplica cor, categoria nem 'ativo'", () => {
    const result = updateServiceSchema.parse({ name: "Volume Russo" });
    expect(result).toEqual({ name: "Volume Russo" });
  });

  it("profissional: renomear não reaplica cor nem ordem", () => {
    expect(updateProfessionalSchema.parse({ name: "Ana" })).toEqual({ name: "Ana" });
  });

  it("cliente: editar o nome não revoga o consentimento LGPD", () => {
    const result = updateClientSchema.parse({ name: "Zeta Silva" });
    expect(result).toEqual({ name: "Zeta Silva" });
    expect("lgpdConsent" in result).toBe(false);
  });

  it("produto: mudar o mínimo não zera marca nem validade", () => {
    expect(updateProductSchema.parse({ minQty: 3 })).toEqual({ minQty: 3 });
  });
});

/**
 * Os schemas são o contrato entre a tela e a API: o mesmo objeto valida os dois
 * lados. Se estes testes passam, formulário e endpoint concordam por construção.
 */

describe("cadastro de cliente", () => {
  it("normaliza telefone, e-mail e instagram", () => {
    const result = createClientSchema.parse({
      name: "  Camila Ferraz  ",
      phone: "(41) 98877-6655",
      email: "CAMILA@Email.COM",
      instagram: "@camilaferraz",
      lgpdConsent: true,
    });

    expect(result.name).toBe("Camila Ferraz");
    expect(result.phone).toBe("41988776655"); // só dígitos
    expect(result.email).toBe("camila@email.com"); // minúsculas
    expect(result.instagram).toBe("camilaferraz"); // sem o @
  });

  it("aceita o Instagram colado como URL", () => {
    const result = createClientSchema.parse({
      name: "Teste",
      phone: "41991234567",
      instagram: "https://instagram.com/dellbeautystudio/",
    });
    expect(result.instagram).toBe("dellbeautystudio");
  });

  it("transforma campos opcionais vazios em null, não em string vazia", () => {
    const result = createClientSchema.parse({
      name: "Teste",
      phone: "41991234567",
      email: "",
      birthDate: "",
      notes: "",
      source: "",
    });

    expect(result.email).toBeNull();
    expect(result.birthDate).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.source).toBeNull();
  });

  it("recusa telefone sem DDD válido", () => {
    const result = createClientSchema.safeParse({ name: "Teste", phone: "99123456" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["phone"]);
    }
  });

  it("exige nome com pelo menos duas letras", () => {
    expect(createClientSchema.safeParse({ name: "A", phone: "41991234567" }).success).toBe(false);
  });
});

describe("procedimento", () => {
  it("recusa duração fora de faixa razoável", () => {
    const base = { name: "Volume Russo", priceCents: 25000 };
    expect(createServiceSchema.safeParse({ ...base, durationMin: 0 }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...base, durationMin: 900 }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...base, durationMin: 150 }).success).toBe(true);
  });

  it("recusa cor fora do formato #RRGGBB", () => {
    const base = { name: "Teste", durationMin: 60, priceCents: 0 };
    expect(createServiceSchema.safeParse({ ...base, color: "vermelho" }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...base, color: "#be3f6c" }).success).toBe(true);
  });
});

describe("agendamento", () => {
  it("aceita instante ISO e converte para Date", () => {
    const result = createAppointmentSchema.parse({
      clientId: "c1",
      serviceId: "s1",
      professionalId: "p1",
      startAt: "2026-08-12T17:30:00.000Z",
    });
    expect(result.startAt).toBeInstanceOf(Date);
    expect(result.startAt.toISOString()).toBe("2026-08-12T17:30:00.000Z");
    expect(result.status).toBe("SCHEDULED"); // padrão
  });

  it("aceita múltiplos procedimentos com serviceIds", () => {
    const result = createAppointmentSchema.parse({
      clientId: "c1",
      serviceIds: ["s1", "s2"],
      professionalId: "p1",
      startAt: "2026-08-12T17:30:00.000Z",
    });
    expect(result.serviceIds).toEqual(["s1", "s2"]);
    expect(result.serviceId).toBe("s1");
  });

  it("exige cliente, procedimento e profissional", () => {
    const result = createAppointmentSchema.safeParse({
      clientId: "",
      serviceId: "s1",
      professionalId: "p1",
      startAt: "2026-08-12T17:30:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("estoque", () => {
  it("recusa quantidade negativa no cadastro", () => {
    expect(createProductSchema.safeParse({ name: "Cola", initialQty: -1 }).success).toBe(false);
    expect(createProductSchema.safeParse({ name: "Cola", minQty: -5 }).success).toBe(false);
  });

  it("aceita os quatro tipos de movimento", () => {
    for (const type of ["IN", "OUT", "ADJUST", "LOSS"] as const) {
      const result = createMovementSchema.safeParse({ productId: "p1", type, quantity: 3 });
      expect(result.success, `tipo ${type}`).toBe(true);
    }
  });

  it("recusa tipo de movimento desconhecido", () => {
    expect(
      createMovementSchema.safeParse({ productId: "p1", type: "TRANSFER", quantity: 1 }).success,
    ).toBe(false);
  });

  it("aceita quantidade fracionada, para produtos em ml", () => {
    const result = createMovementSchema.parse({ productId: "p1", type: "OUT", quantity: "2.5" });
    expect(result.quantity).toBe(2.5);
  });
});

describe("anamnese dto", () => {
  const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  it("aceita respostas de perguntas conhecidas", () => {
    const r = answersSchema.safeParse({ gestante: { value: true, detail: "20 semanas" } });
    expect(r.success).toBe(true);
  });

  it("recusa resposta de pergunta desconhecida", () => {
    const r = answersSchema.safeParse({ pergunta_que_nao_existe: { value: true } });
    expect(r.success).toBe(false);
  });

  it("assinar exige as duas assinaturas", () => {
    expect(signAnamneseSchema.safeParse({ clientSignature: PNG }).success).toBe(false);
    expect(
      signAnamneseSchema.safeParse({ clientSignature: PNG, professionalSignature: PNG }).success,
    ).toBe(true);
  });

  it("recusa assinatura que não é um PNG data URI", () => {
    const r = signAnamneseSchema.safeParse({
      clientSignature: "javascript:alert(1)",
      professionalSignature: PNG,
    });
    expect(r.success).toBe(false);
  });
});
