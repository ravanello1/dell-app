import { NextResponse } from "next/server";
import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { slugify } from "@/core/utils/text";
import { exportClientData } from "@/modules/clients/client.service";

/**
 * GET /api/v1/clients/:id/export — baixa tudo que o sistema guarda sobre a
 * cliente, em JSON (LGPD, art. 18 — direito de acesso aos dados).
 */
export const GET = defineRoute({ params: idParamSchema }, async ({ params, session }) => {
  const data = await exportClientData(params.id, session);

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dados-${slugify(data.cliente.nome)}.json"`,
    },
  });
});
