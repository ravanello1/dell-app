import { NextResponse } from "next/server";
import { z } from "zod";
import { booleanFlag } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { createProfessionalSchema } from "@/modules/agenda/agenda.dto";
import { createProfessional, listProfessionals } from "@/modules/agenda/agenda.service";

const querySchema = z.object({ includeInactive: booleanFlag(false) });

export const GET = defineRoute({ query: querySchema }, ({ query }) =>
  listProfessionals(query.includeInactive),
);

export const POST = defineRoute(
  { body: createProfessionalSchema, roles: ["OWNER"] },
  async ({ body }) => {
    const professional = await createProfessional(body);
    return NextResponse.json({ data: professional }, { status: 201 });
  },
);
