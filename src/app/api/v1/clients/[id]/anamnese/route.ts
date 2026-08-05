import { NextResponse } from "next/server";
import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { createAnamneseSchema } from "@/modules/anamnese/anamnese.dto";
import { createForClient, listByClient } from "@/modules/anamnese/anamnese.service";

/** GET /api/v1/clients/:id/anamnese — histórico de fichas da cliente. */
export const GET = defineRoute(
  { params: idParamSchema, roles: ["OWNER", "PRO"] },
  ({ params, session }) => listByClient(params.id, session),
);

/** POST /api/v1/clients/:id/anamnese — abre uma ficha do procedimento escolhido
 *  (ou devolve o rascunho aberto daquele procedimento). */
export const POST = defineRoute(
  { params: idParamSchema, body: createAnamneseSchema, roles: ["OWNER", "PRO"] },
  async ({ params, body, session }) => {
    const anamnese = await createForClient(params.id, body.procedure, session);
    return NextResponse.json({ data: anamnese }, { status: 201 });
  },
);
