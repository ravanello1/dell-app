import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { updateClientSchema } from "@/modules/clients/client.dto";
import { archiveClient, getClient, updateClient } from "@/modules/clients/client.service";

/** GET /api/v1/clients/:id — ficha completa. */
export const GET = defineRoute({ params: idParamSchema }, ({ params, session }) =>
  getClient(params.id, session),
);

/** PATCH /api/v1/clients/:id — atualiza os campos enviados. */
export const PATCH = defineRoute(
  { params: idParamSchema, body: updateClientSchema },
  ({ params, body, session }) => updateClient(params.id, body, session),
);

/**
 * DELETE /api/v1/clients/:id — arquiva (soft delete).
 * A exclusão definitiva fica em `/erase`, para não acontecer por engano.
 */
export const DELETE = defineRoute({ params: idParamSchema }, async ({ params }) => {
  await archiveClient(params.id);
});
