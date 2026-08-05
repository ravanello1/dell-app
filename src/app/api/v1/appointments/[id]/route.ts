import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { updateAppointmentSchema } from "@/modules/agenda/agenda.dto";
import {
  deleteAppointment,
  getAppointment,
  updateAppointment,
} from "@/modules/agenda/agenda.service";

export const GET = defineRoute({ params: idParamSchema }, ({ params }) => getAppointment(params.id));

/** Serve tanto para remarcar quanto para mudar o status. */
export const PATCH = defineRoute(
  { params: idParamSchema, body: updateAppointmentSchema },
  ({ params, body }) => updateAppointment(params.id, body),
);

/**
 * Apaga o registro. No dia a dia o certo é cancelar (PATCH com status
 * CANCELED), que preserva o histórico — por isso apagar é restrito à dona.
 */
export const DELETE = defineRoute(
  { params: idParamSchema, roles: ["OWNER"] },
  async ({ params }) => {
    await deleteAppointment(params.id);
  },
);
