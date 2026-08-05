import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/core/auth/session";

/**
 * Interceptador de requisições (no Next 16 este arquivo se chama `proxy.ts` —
 * era o antigo `middleware.ts`).
 *
 * É a primeira barreira: nenhuma página ou rota de API do app responde sem um
 * cookie de sessão válido. As camadas seguintes (layout do grupo `(app)` e o
 * wrapper de rota) repetem a verificação de propósito — se um dia alguém mudar
 * o `matcher` daqui, o sistema não fica aberto.
 */

/** Caminhos que respondem sem sessão. */
const PUBLIC_PATHS = ["/login", "/manifest.webmanifest", "/sw.js", "/api/v1/health"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // Ícones do PWA precisam carregar na tela de login e no instalador.
  if (pathname.startsWith("/pwa-icon/")) return true;
  return false;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (session) {
    // Já autenticado tentando abrir o login: manda para o painel.
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (isPublic(pathname)) return NextResponse.next();

  // API responde 401 em JSON; o cliente trata sem receber um HTML de login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sessão expirada. Entre novamente." } },
      { status: 401 },
    );
  }

  // Páginas: leva ao login guardando para onde a pessoa queria ir.
  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Tudo, exceto os assets estáticos do próprio Next e os arquivos de
     * metadados que o navegador busca antes de haver qualquer sessão.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|robots.txt).*)",
  ],
};
