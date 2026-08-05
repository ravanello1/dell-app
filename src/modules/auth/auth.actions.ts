"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/core/auth/session";
import { isAppError } from "@/core/api/errors";
import { authenticate, loginSchema } from "./auth.service";

export interface LoginState {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
}

/**
 * Entrar. É uma Server Action e não uma rota de API porque só aqui dá para
 * gravar o cookie de sessão e redirecionar na mesma resposta — e porque assim
 * o formulário continua funcionando mesmo antes do JavaScript carregar.
 */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    const fieldErrors: LoginState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "email" || key === "password") fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  try {
    const user = await authenticate(parsed.data);
    await createSession(user);
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    console.error("[auth] falha inesperada no login:", error);
    return { error: "Não foi possível entrar agora. Tente novamente." };
  }

  // `redirect` lança por dentro — precisa ficar fora do try/catch acima.
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
