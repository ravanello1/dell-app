import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { markReminderSent } from "@/modules/agenda/agenda.service";

/**
 * POST /api/v1/appointments/:id/reminder — registra que o lembrete foi enviado.
 *
 * O envio em si acontece pelo WhatsApp, fora do sistema (link wa.me com a
 * mensagem pronta). Aqui só fica a marca de que já foi feito, para ninguém
 * mandar duas vezes — e é o gancho para automatizar via API oficial depois.
 */
export const POST = defineRoute({ params: idParamSchema }, ({ params }) =>
  markReminderSent(params.id),
);
