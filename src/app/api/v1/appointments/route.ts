import { NextResponse } from "next/server";
import { defineRoute } from "@/core/api/handler";
import { agendaRangeSchema, createAppointmentSchema } from "@/modules/agenda/agenda.dto";
import { createAppointment, listAgenda } from "@/modules/agenda/agenda.service";

/** GET /api/v1/appointments?from&to — atendimentos da janela consultada. */
export const GET = defineRoute({ query: agendaRangeSchema }, ({ query }) => listAgenda(query));

/** POST /api/v1/appointments — marca um atendimento (409 se o horário colidir). */
export const POST = defineRoute({ body: createAppointmentSchema }, async ({ body, session }) => {
  const appointment = await createAppointment(body, session);
  return NextResponse.json({ data: appointment }, { status: 201 });
});
