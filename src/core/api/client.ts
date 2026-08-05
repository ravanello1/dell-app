import type { AppErrorCode, FieldErrors } from "./errors";

/**
 * Cliente HTTP do navegador para a API do próprio app.
 *
 * Traduz a resposta de erro padronizada (`{ error: { code, message, fields } }`)
 * numa exceção tipada, para que a tela consiga distinguir "sessão expirou" de
 * "campo inválido" sem inspecionar JSON solto.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: AppErrorCode | "OFFLINE" | "NETWORK";
  readonly fields?: FieldErrors;

  constructor(
    status: number,
    code: ApiError["code"],
    message: string,
    fields?: FieldErrors,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  let response: Response;

  try {
    response = await fetch(`/api/v1${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
      // O cookie de sessão é httpOnly; `same-origin` é o suficiente.
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Sem conexão com o servidor. Verifique sua internet.");
  }

  if (response.status === 204) {
    return { data: undefined as T };
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | { error: { code: AppErrorCode; message: string; fields?: FieldErrors } }
    | null;

  if (!response.ok) {
    const error = payload && "error" in payload ? payload.error : null;
    throw new ApiError(
      response.status,
      error?.code ?? "INTERNAL",
      error?.message ?? "Não foi possível completar a operação.",
      error?.fields,
    );
  }

  if (!payload || !("data" in payload)) {
    throw new ApiError(response.status, "INTERNAL", "Resposta do servidor em formato inesperado.");
  }

  return payload;
}

export const api = {
  get: <T>(path: string) => request<T>(path).then((envelope) => envelope.data),
  /** Igual ao `get`, mas devolve também os metadados (paginação). */
  getWithMeta: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }).then((e) => e.data),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }).then((e) => e.data),
  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }).then((e) => e.data),
};

/** Monta a query string ignorando valores vazios. */
export function toQueryString(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === null) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
