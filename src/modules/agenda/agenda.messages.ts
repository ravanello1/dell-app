import { formatDateTime } from "@/core/utils/date";
import { firstName } from "@/core/utils/text";
import type { AppointmentDto } from "./agenda.dto";

/**
 * Textos que saem do sistema para a cliente.
 *
 * Módulo separado do service de propósito: o service conversa com o banco, e o
 * navegador precisa gerar esta mensagem na hora de abrir o WhatsApp. Mantê-la
 * numa função pura evita arrastar o driver do banco para dentro do bundle do
 * cliente.
 */

/**
 * Lembrete de confirmação.
 *
 * Escrito no tom que o studio usaria numa conversa de verdade — quem recebe é
 * uma cliente, não um sistema. Mensagem de robô faz a pessoa não responder.
 */
export function buildReminderMessage(appointment: AppointmentDto, studioName: string): string {
  return (
    `Oi, ${firstName(appointment.client.name)}! Tudo bem? 💛\n\n` +
    `Passando para confirmar seu horário no ${studioName}:\n\n` +
    `✨ ${appointment.service.name}\n` +
    `📅 ${formatDateTime(new Date(appointment.startAt))}\n` +
    `💁 com ${appointment.professional.name}\n\n` +
    `Consegue confirmar para mim?`
  );
}

/** Aviso de retorno, para quando a manutenção estiver chegando. */
export function buildRebookMessage(clientName: string, studioName: string): string {
  return (
    `Oi, ${firstName(clientName)}! 💛\n\n` +
    `Já faz um tempinho desde o seu último atendimento no ${studioName}. ` +
    `Quer que eu reserve um horário para a manutenção?`
  );
}

/** Felicitação de aniversário. */
export function buildBirthdayMessage(clientName: string, studioName: string): string {
  return (
    `Feliz aniversário, ${firstName(clientName)}! 🎂✨\n\n` +
    `Todo o carinho do ${studioName} para você hoje. ` +
    `Que tal comemorar com os cílios novos?`
  );
}
