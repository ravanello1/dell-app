import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { AppError, ValidationError, isAppError, type FieldErrors } from "./errors";
import { requireRole, requireSession } from "@/core/auth/guard";
import type { SessionUser } from "@/core/auth/session";
import type { UserRole } from "@/modules/auth/user.schema";

/**
 * Wrapper único de todas as rotas de `/api/v1`.
 *
 * Cada rota declara o que precisa — papéis, formato do corpo, formato da query —
 * e recebe tudo já validado e tipado. Autenticação, permissão, validação,
 * tradução de erro para HTTP e formato da resposta ficam resolvidos aqui, uma
 * vez só, em vez de repetidos em cada arquivo de rota.
 */

type ResponseBody<T> = { data: T; meta?: Record<string, unknown> };

export interface RouteInput<TBody, TQuery, TParams> {
  request: NextRequest;
  body: TBody;
  query: TQuery;
  params: TParams;
  session: SessionUser;
}

interface RouteConfig<TBody, TQuery, TParams> {
  /** Papéis permitidos. Vazio/ausente = qualquer usuário autenticado. */
  roles?: readonly UserRole[];
  /** Rota sem autenticação (login, health check). */
  isPublic?: boolean;
  body?: z.ZodType<TBody>;
  query?: z.ZodType<TQuery>;
  params?: z.ZodType<TParams>;
}

type NextRouteContext = { params: Promise<Record<string, string | string[]>> };

/** Converte os erros do Zod no formato `{ campo: [mensagens] }`. */
function toFieldErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

/**
 * Bloqueia requisições de escrita vindas de outra origem. Junto com o cookie
 * `SameSite=Lax`, cobre o vetor de CSRF sem precisar de token sincronizado.
 */
function hasValidOrigin(request: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;

  const origin = request.headers.get("origin");
  if (!origin) return true; // clientes não-navegador não mandam Origin

  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

function errorResponse(error: AppError) {
  return NextResponse.json(
    { error: { code: error.code, message: error.message, fields: error.fields } },
    { status: error.status },
  );
}

export function defineRoute<TBody = undefined, TQuery = undefined, TParams = undefined>(
  config: RouteConfig<TBody, TQuery, TParams>,
  handler: (input: RouteInput<TBody, TQuery, TParams>) => Promise<unknown> | unknown,
) {
  return async (request: NextRequest, context: NextRouteContext): Promise<NextResponse> => {
    try {
      if (!hasValidOrigin(request)) {
        return errorResponse(new AppError("FORBIDDEN", 403, "Origem da requisição não permitida."));
      }

      const session = config.isPublic
        ? ({ id: "", name: "", email: "", role: "RECEPTION" } as SessionUser)
        : config.roles && config.roles.length > 0
          ? await requireRole(...config.roles)
          : await requireSession();

      // Parâmetros da rota — assíncronos a partir do Next 16.
      const rawParams = context?.params ? await context.params : {};
      let params = rawParams as TParams;
      if (config.params) {
        const parsed = config.params.safeParse(rawParams);
        if (!parsed.success) {
          throw new ValidationError("Endereço inválido.", toFieldErrors(parsed.error));
        }
        params = parsed.data;
      }

      let query = undefined as TQuery;
      if (config.query) {
        const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
        const parsed = config.query.safeParse(raw);
        if (!parsed.success) {
          throw new ValidationError("Filtros inválidos.", toFieldErrors(parsed.error));
        }
        query = parsed.data;
      }

      let body = undefined as TBody;
      if (config.body) {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          throw new ValidationError("Corpo da requisição não é um JSON válido.");
        }
        const parsed = config.body.safeParse(raw);
        if (!parsed.success) {
          throw new ValidationError("Confira os campos destacados.", toFieldErrors(parsed.error));
        }
        body = parsed.data;
      }

      const result = await handler({ request, body, query, params, session });

      if (result instanceof NextResponse) return result;
      if (result === undefined || result === null) {
        return new NextResponse(null, { status: 204 });
      }
      return NextResponse.json({ data: result } satisfies ResponseBody<unknown>);
    } catch (error) {
      if (isAppError(error)) return errorResponse(error);

      // Erro não previsto: registra o detalhe no servidor e devolve algo genérico.
      console.error("[api] erro não tratado:", error);
      return errorResponse(
        new AppError("INTERNAL", 500, "Algo deu errado do nosso lado. Tente novamente."),
      );
    }
  };
}

/** Envelopa uma lista com metadados de paginação. */
export function paginated<T>(items: T[], meta: { total: number; page: number; perPage: number }) {
  return NextResponse.json({
    data: items,
    meta: { ...meta, totalPages: Math.max(1, Math.ceil(meta.total / meta.perPage)) },
  });
}
