import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { listClientHistory } from "@/modules/agenda/agenda.service";

/**
 * GET /api/v1/clients/:id/appointments — histórico de atendimentos da cliente.
 *
 * Mora sob `/clients` porque é assim que a ficha da cliente consome, mas quem
 * responde é o serviço da agenda: o módulo de clientes não conhece a tabela de
 * agendamentos, e continua não conhecendo.
 */
export const GET = defineRoute({ params: idParamSchema }, ({ params }) =>
  listClientHistory(params.id),
);
