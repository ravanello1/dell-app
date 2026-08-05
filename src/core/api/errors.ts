/**
 * Erros de domínio com tradução direta para HTTP.
 *
 * O service lança um destes sem saber que existe uma requisição; o wrapper de
 * rota converte para status e corpo JSON. Isso mantém a regra de negócio
 * testável sem simular `Request`/`Response`.
 */

export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "BAD_REQUEST"
  | "INTERNAL";

/** Erros por campo, no formato que o formulário consome direto. */
export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly fields?: FieldErrors;

  constructor(code: AppErrorCode, status: number, message: string, fields?: FieldErrors) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Você precisa entrar para continuar.") {
    super("UNAUTHORIZED", 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Seu perfil não tem permissão para esta ação.") {
    super("FORBIDDEN", 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(what = "Registro") {
    super("NOT_FOUND", 404, `${what} não encontrado.`);
  }
}

/** Estado do sistema impede a operação — ex.: horário já ocupado. */
export class ConflictError extends AppError {
  constructor(message: string, fields?: FieldErrors) {
    super("CONFLICT", 409, message, fields);
  }
}

/** Dados enviados não passaram na validação. */
export class ValidationError extends AppError {
  constructor(message = "Confira os campos destacados.", fields?: FieldErrors) {
    super("VALIDATION", 422, message, fields);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super("BAD_REQUEST", 400, message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
