/**
 * Telefones são guardados só com dígitos ("41991234567"): assim a busca por
 * telefone funciona independente de como a pessoa digitou. Máscara e link de
 * WhatsApp são derivados na hora de exibir.
 */

/** Remove tudo que não for dígito. */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}

/** "41991234567" → "(41) 99123-4567" · "4133221100" → "(41) 3322-1100" */
export function formatPhone(digits: string): string {
  const value = normalizePhone(digits);
  if (value.length === 11) {
    return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
  }
  if (value.length === 10) {
    return `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
  }
  return value;
}

/** Aplica a máscara enquanto a pessoa digita, sem exigir número completo. */
export function maskPhoneInput(input: string): string {
  const value = normalizePhone(input).slice(0, 11);
  if (value.length <= 2) return value;
  if (value.length <= 6) return `(${value.slice(0, 2)}) ${value.slice(2)}`;
  if (value.length <= 10) return `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
  return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
}

/** Telefone brasileiro válido: 10 dígitos (fixo) ou 11 (celular com 9). */
export function isValidBrazilianPhone(input: string): boolean {
  const value = normalizePhone(input);
  if (value.length !== 10 && value.length !== 11) return false;
  const areaCode = Number(value.slice(0, 2));
  if (areaCode < 11 || areaCode > 99) return false;
  // Celular no Brasil sempre começa com 9 depois do DDD.
  if (value.length === 11 && value[2] !== "9") return false;
  return true;
}

/**
 * Link direto de conversa no WhatsApp com a mensagem já escrita.
 * Assume Brasil (+55) quando o número vem sem código de país.
 */
export function whatsappLink(phone: string, message?: string): string {
  const digits = normalizePhone(phone);
  const withCountry = digits.startsWith("55") && digits.length > 11 ? digits : `55${digits}`;
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${withCountry}${query}`;
}
