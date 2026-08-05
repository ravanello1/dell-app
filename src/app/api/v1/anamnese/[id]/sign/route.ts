import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { signAnamneseSchema } from "@/modules/anamnese/anamnese.dto";
import { sign } from "@/modules/anamnese/anamnese.service";

/**
 * POST /api/v1/anamnese/:id/sign — assina a ficha (cliente + profissional).
 * Rota separada: assinar é o ato que fecha o documento, não um PATCH comum.
 */
export const POST = defineRoute(
  { params: idParamSchema, body: signAnamneseSchema, roles: ["OWNER", "PRO"] },
  ({ params, body, session }) => sign(params.id, body, session),
);
