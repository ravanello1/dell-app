import { NextResponse } from "next/server";
import { defineRoute } from "@/core/api/handler";
import { clientQuerySchema, createClientSchema } from "@/modules/clients/client.dto";
import { createClient, listClients } from "@/modules/clients/client.service";

/** GET /api/v1/clients — lista paginada, com busca por nome ou telefone. */
export const GET = defineRoute(
  { query: clientQuerySchema },
  async ({ query, session }) => {
    const { items, meta } = await listClients(query, session);
    return NextResponse.json({ data: items, meta });
  },
);

/** POST /api/v1/clients — cadastra uma cliente. */
export const POST = defineRoute({ body: createClientSchema }, async ({ body, session }) => {
  const client = await createClient(body, session);
  return NextResponse.json({ data: client }, { status: 201 });
});
