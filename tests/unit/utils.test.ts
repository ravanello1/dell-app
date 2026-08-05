import { describe, expect, it } from "vitest";
import { centsToInput, formatCents, inputToCents } from "@/core/utils/money";
import {
  formatPhone,
  isValidBrazilianPhone,
  maskPhoneInput,
  normalizePhone,
  whatsappLink,
} from "@/core/utils/phone";
import { initials, slugify, stripAccents } from "@/core/utils/text";
import {
  ageFromBirthDate,
  formatDuration,
  overlaps,
  studioStartOfDay,
  studioWallTimeToInstant,
  toDateInputValue,
  toTimeInputValue,
} from "@/core/utils/date";

/**
 * `Intl.NumberFormat` separa "R$" do valor com espaço não-quebrável (U+00A0),
 * de propósito — é o certo tipograficamente, para o símbolo nunca ficar sozinho
 * no fim de uma linha. Nos testes, normalizamos para poder comparar.
 */
const semNbsp = (value: string) => value.replace(/\u00a0/g, " ");

describe("dinheiro", () => {
  it("formata centavos em reais", () => {
    expect(semNbsp(formatCents(18000))).toBe("R$ 180,00");
    expect(semNbsp(formatCents(0))).toBe("R$ 0,00");
    expect(semNbsp(formatCents(1))).toBe("R$ 0,01");
    expect(semNbsp(formatCents(123456))).toBe("R$ 1.234,56");
  });

  it("interpreta o que uma pessoa realmente digita", () => {
    expect(inputToCents("180,00")).toBe(18000);
    expect(inputToCents("R$ 1.234,56")).toBe(123456);
    expect(inputToCents("1234.56")).toBe(123456);
    expect(inputToCents("180")).toBe(18000);
    expect(inputToCents("")).toBeNull();
    expect(inputToCents("abc")).toBeNull();
  });

  it("faz a viagem de ida e volta sem perder centavo", () => {
    for (const cents of [0, 1, 99, 100, 12345, 999999]) {
      expect(inputToCents(centsToInput(cents))).toBe(cents);
    }
  });
});

describe("telefone", () => {
  it("guarda só dígitos e exibe com máscara", () => {
    expect(normalizePhone("(41) 99123-4567")).toBe("41991234567");
    expect(formatPhone("41991234567")).toBe("(41) 99123-4567");
    expect(formatPhone("4133221100")).toBe("(41) 3322-1100");
  });

  it("aplica a máscara enquanto se digita", () => {
    expect(maskPhoneInput("41")).toBe("41");
    expect(maskPhoneInput("419")).toBe("(41) 9");
    expect(maskPhoneInput("419912")).toBe("(41) 9912");
    expect(maskPhoneInput("41991234567")).toBe("(41) 99123-4567");
    // não deixa passar de 11 dígitos
    expect(maskPhoneInput("419912345678888")).toBe("(41) 99123-4567");
  });

  it("valida números brasileiros", () => {
    expect(isValidBrazilianPhone("41991234567")).toBe(true); // celular
    expect(isValidBrazilianPhone("4133221100")).toBe(true); // fixo
    expect(isValidBrazilianPhone("419912345")).toBe(false); // curto demais
    expect(isValidBrazilianPhone("01991234567")).toBe(false); // DDD inválido
    expect(isValidBrazilianPhone("41891234567")).toBe(false); // celular sem o 9
  });

  it("monta o link do WhatsApp com código do país", () => {
    const link = whatsappLink("41991234567", "Oi!");
    expect(link).toContain("https://wa.me/5541991234567");
    expect(link).toContain("text=Oi!");
  });
});

describe("texto", () => {
  it("remove acentos e monta slug", () => {
    expect(stripAccents("Ângela Gonçalves")).toBe("Angela Goncalves");
    expect(slugify("Ângela Gonçalves")).toBe("angela-goncalves");
    expect(slugify("  Cílios C 0.07 — 11mm ")).toBe("cilios-c-0-07-11mm");
  });

  it("monta iniciais para o avatar", () => {
    expect(initials("Maria Eduarda Silva")).toBe("MS");
    expect(initials("Dell")).toBe("D");
    expect(initials("  ")).toBe("?");
  });
});

describe("datas no fuso do studio", () => {
  it("converte horário de parede de Curitiba para instante UTC", () => {
    // Curitiba é UTC-3: 14:30 local = 17:30 UTC
    const instant = studioWallTimeToInstant("2026-08-12", "14:30");
    expect(instant.toISOString()).toBe("2026-08-12T17:30:00.000Z");
  });

  it("faz a volta preservando o horário de parede", () => {
    const instant = studioWallTimeToInstant("2026-08-12", "09:05");
    expect(toDateInputValue(instant)).toBe("2026-08-12");
    expect(toTimeInputValue(instant)).toBe("09:05");
  });

  it("começa o dia à meia-noite de Curitiba, não de UTC", () => {
    // 23h de 4/ago em Curitiba já é 5/ago em UTC — o dia do studio não muda.
    const lateNight = studioWallTimeToInstant("2026-08-04", "23:30");
    expect(toDateInputValue(studioStartOfDay(lateNight))).toBe("2026-08-04");
  });

  it("detecta sobreposição de intervalos", () => {
    const at = (time: string) => studioWallTimeToInstant("2026-08-12", time);

    // [09:00,11:00) contra [10:00,12:00) — se sobrepõem
    expect(overlaps(at("09:00"), at("11:00"), at("10:00"), at("12:00"))).toBe(true);
    // encostados não colidem: um termina quando o outro começa
    expect(overlaps(at("09:00"), at("11:00"), at("11:00"), at("12:00"))).toBe(false);
    // um contido no outro
    expect(overlaps(at("09:00"), at("13:00"), at("10:00"), at("11:00"))).toBe(true);
    // sem interseção
    expect(overlaps(at("09:00"), at("10:00"), at("14:00"), at("15:00"))).toBe(false);
  });

  it("formata duração de forma legível", () => {
    expect(formatDuration(45)).toBe("45min");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h30");
    expect(formatDuration(125)).toBe("2h05");
  });

  it("calcula idade sem errar por causa de fuso", () => {
    const age = ageFromBirthDate("1994-08-19");
    expect(age).toBeGreaterThan(20);
    expect(age).toBeLessThan(60);
    expect(ageFromBirthDate("data-inválida")).toBeNull();
  });
});
