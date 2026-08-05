import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { updateProfessionalSchema } from "@/modules/agenda/agenda.dto";
import { updateProfessional } from "@/modules/agenda/agenda.service";

export const PATCH = defineRoute(
  { params: idParamSchema, body: updateProfessionalSchema, roles: ["OWNER"] },
  ({ params, body }) => updateProfessional(params.id, body),
);
