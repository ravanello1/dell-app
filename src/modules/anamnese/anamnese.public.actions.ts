"use server";

import { isAppError } from "@/core/api/errors";
import { submitPublicSchema } from "./anamnese.dto";
import { submitPublicByToken } from "./anamnese.service";

/**
 * Envio da cliente pelo link público. É uma Server Action (não uma rota da API
 * autenticada) porque a página é pública e o token é a credencial. O Next
 * protege a action contra CSRF por conta própria; a validação Zod acontece aqui
 * antes de tocar no service.
 */
export type PublicSubmitResult =
  | { ok: true; clientFirstName: string }
  | { ok: false; error: string };

export async function submitPublicAnamneseAction(
  token: string,
  input: unknown,
): Promise<PublicSubmitResult> {
  const parsed = submitPublicSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os campos preenchidos." };
  }

  try {
    const { clientFirstName } = await submitPublicByToken(token, parsed.data);
    return { ok: true, clientFirstName };
  } catch (error) {
    if (isAppError(error)) return { ok: false, error: error.message };
    console.error("[anamnese] falha no envio público:", error);
    return { ok: false, error: "Não foi possível enviar agora. Tente novamente." };
  }
}
