import { describe, expect, it } from "vitest";
import { layoutOverlaps } from "@/modules/agenda/agenda.presentation";

/**
 * Distribuição de cards sobrepostos na grade do calendário.
 *
 * Importa porque a regra de conflito não cobre tudo: atendimentos cancelados e
 * faltas continuam desenhados e podem cair em cima de um horário reocupado.
 */
const slot = (startHour: number, endHour: number) => ({
  startAt: `2026-08-12T${String(startHour).padStart(2, "0")}:00:00.000Z`,
  endAt: `2026-08-12T${String(endHour).padStart(2, "0")}:00:00.000Z`,
});

describe("layout de sobreposição", () => {
  it("dá coluna inteira quando nada se sobrepõe", () => {
    const result = layoutOverlaps([slot(9, 10), slot(11, 12), slot(14, 15)]);
    expect(result).toHaveLength(3);
    for (const entry of result) {
      expect(entry.column).toBe(0);
      expect(entry.columns).toBe(1);
    }
  });

  it("divide em duas colunas quando dois se cruzam", () => {
    const result = layoutOverlaps([slot(9, 11), slot(10, 12)]);
    expect(result.map((entry) => entry.column).sort()).toEqual([0, 1]);
    for (const entry of result) expect(entry.columns).toBe(2);
  });

  it("acomoda três sobrepostos em três colunas", () => {
    const result = layoutOverlaps([slot(9, 12), slot(10, 13), slot(11, 14)]);
    expect(result.map((entry) => entry.column).sort()).toEqual([0, 1, 2]);
    for (const entry of result) expect(entry.columns).toBe(3);
  });

  it("reaproveita a coluna liberada", () => {
    // 9–10 e 10–11 não colidem entre si, mas ambos colidem com 9–11.
    const result = layoutOverlaps([slot(9, 11), slot(9, 10), slot(10, 11)]);
    expect(result).toHaveLength(3);
    // O grupo inteiro tem 2 colunas; o terceiro reaproveita a que vagou.
    for (const entry of result) expect(entry.columns).toBe(2);
  });

  it("separa grupos que não se tocam", () => {
    const result = layoutOverlaps([slot(9, 11), slot(10, 12), slot(15, 16)]);
    const isolated = result.find((entry) => entry.item.startAt.includes("15:"));
    expect(isolated?.columns).toBe(1);
  });

  it("aguenta lista vazia", () => {
    expect(layoutOverlaps([])).toEqual([]);
  });
});
