import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { saveAnamneseSchema } from "@/modules/anamnese/anamnese.dto";
import { discardDraft, getById, saveDraft } from "@/modules/anamnese/anamnese.service";

/** GET /api/v1/anamnese/:id — uma ficha, com as assinaturas (para ver/imprimir). */
export const GET = defineRoute(
  { params: idParamSchema, roles: ["OWNER", "PRO"] },
  ({ params, session }) => getById(params.id, session, { withSignatures: true }),
);

/** PATCH /api/v1/anamnese/:id — salva o rascunho. Recusa se já assinada. */
export const PATCH = defineRoute(
  { params: idParamSchema, body: saveAnamneseSchema, roles: ["OWNER", "PRO"] },
  ({ params, body, session }) => saveDraft(params.id, body, session),
);

/** DELETE /api/v1/anamnese/:id — descarta um rascunho (assinada não se apaga). */
export const DELETE = defineRoute(
  { params: idParamSchema, roles: ["OWNER", "PRO"] },
  async ({ params, session }) => {
    await discardDraft(params.id, session);
  },
);
