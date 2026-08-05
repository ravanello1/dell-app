import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/core/auth/session";

/**
 * Saída de emergência da sessão.
 *
 * Existe para o caso em que o cookie é válido mas não corresponde mais a
 * ninguém — usuário desativado, apagado, ou um token assinado com o segredo de
 * outro ambiente. Sem esta rota, a página mandaria para `/login`, o `proxy`
 * veria um token tecnicamente válido e devolveria ao painel, e os dois ficariam
 * se empurrando. Aqui o cookie é apagado antes do redirecionamento, então o
 * ciclo não tem como recomeçar.
 *
 * Só apaga cookie e redireciona — nenhum dado é alterado —, por isso responde
 * a GET com segurança.
 */
export async function GET(request: NextRequest) {
  await destroySession();

  const loginUrl = new URL("/login", request.url);
  if (request.nextUrl.searchParams.get("motivo") === "sessao-invalida") {
    loginUrl.searchParams.set("motivo", "sessao-invalida");
  }

  return NextResponse.redirect(loginUrl);
}
