/**
 * Dinheiro circula pelo sistema sempre como centavos inteiros. Reais com casa
 * decimal existem apenas na borda: o que o usuário digita e o que ele lê.
 */

const formatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** 12345 → "R$ 123,45" */
export function formatCents(cents: number): string {
  return formatter.format(cents / 100);
}

/** 12345 → "123,45" (sem símbolo, para dentro de campos de formulário) */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Converte o que o usuário digitou em centavos. Aceita "R$ 1.234,56", "1234,56",
 * "1234.56" e "1234" — qualquer coisa que uma pessoa realmente digitaria.
 * Retorna null quando não dá para interpretar.
 */
export function inputToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, "").trim();
  if (cleaned === "") return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : lastDot > lastComma ? "." : null;

  let normalized: string;
  if (decimalSeparator === null) {
    normalized = cleaned;
  } else {
    const separatorIndex = decimalSeparator === "," ? lastComma : lastDot;
    const integerPart = cleaned.slice(0, separatorIndex).replace(/[.,]/g, "");
    const decimalPart = cleaned.slice(separatorIndex + 1).replace(/[.,]/g, "");
    normalized = `${integerPart}.${decimalPart}`;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}
