import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { updateServiceSchema } from "@/modules/agenda/agenda.dto";
import { updateService } from "@/modules/agenda/agenda.service";

export const PATCH = defineRoute(
  { params: idParamSchema, body: updateServiceSchema, roles: ["OWNER"] },
  ({ params, body }) => updateService(params.id, body),
);
