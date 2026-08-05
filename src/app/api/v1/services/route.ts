import { NextResponse } from "next/server";
import { z } from "zod";
import { booleanFlag } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { createServiceSchema } from "@/modules/agenda/agenda.dto";
import { createService, listServices } from "@/modules/agenda/agenda.service";

const querySchema = z.object({ includeInactive: booleanFlag(false) });

export const GET = defineRoute({ query: querySchema }, ({ query }) =>
  listServices(query.includeInactive),
);

/** Cadastrar procedimento define preço e duração — decisão da proprietária. */
export const POST = defineRoute(
  { body: createServiceSchema, roles: ["OWNER"] },
  async ({ body }) => {
    const service = await createService(body);
    return NextResponse.json({ data: service }, { status: 201 });
  },
);
