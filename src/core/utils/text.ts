/** Remove acentos: "Ângela Gonçalves" → "Angela Goncalves". */
export function stripAccents(value: string): string {
  // NFD separa a letra do acento; o intervalo removido são as marcas combinantes.
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** "Ângela Gonçalves" → "angela-goncalves" — para nomes de arquivo e URLs. */
export function slugify(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Busca que ignora acento e caixa: "jose" encontra "José". */
export function normalizeForSearch(value: string): string {
  return stripAccents(value).toLowerCase().trim();
}

/** "Maria Eduarda Silva" → "ME" — para avatares sem foto. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Primeiro nome, para saudações. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
