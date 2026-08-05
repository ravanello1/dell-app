import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { eraseClient } from "@/modules/clients/client.service";

/**
 * POST /api/v1/clients/:id/erase — exclusão definitiva (LGPD, art. 18).
 *
 * Rota separada e restrita à proprietária de propósito: apagar sem volta não
 * pode compartilhar o mesmo verbo de "arquivar".
 */
export const POST = defineRoute(
  { params: idParamSchema, roles: ["OWNER"] },
  async ({ params, session }) => {
    await eraseClient(params.id, session);
  },
);
