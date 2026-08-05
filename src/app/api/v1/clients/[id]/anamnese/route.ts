import { NextResponse } from "next/server";
import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { createForClient, listByClient } from "@/modules/anamnese/anamnese.service";

/** GET /api/v1/clients/:id/anamnese — histórico de fichas da cliente. */
export const GET = defineRoute(
  { params: idParamSchema, roles: ["OWNER", "PRO"] },
  ({ params, session }) => listByClient(params.id, session),
);

/** POST /api/v1/clients/:id/anamnese — abre uma ficha nova (ou o rascunho aberto). */
export const POST = defineRoute(
  { params: idParamSchema, roles: ["OWNER", "PRO"] },
  async ({ params, session }) => {
    const anamnese = await createForClient(params.id, session);
    return NextResponse.json({ data: anamnese }, { status: 201 });
  },
);
