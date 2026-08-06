import { studio } from "@/core/config/studio";

/**
 * Mensagens prontas de marketing.
 *
 * Ficam no código porque são poucas e servem de ponto de partida — a
 * profissional sempre pode ajustar o texto no próprio WhatsApp antes de enviar.
 * O marcador `{nome}` é trocado pelo primeiro nome da cliente.
 *
 * Promoções são o caso à parte: essas a profissional cria e guarda no banco.
 */

export interface MessageTemplate {
  id: string;
  label: string;
  body: string;
}

export const birthdayTemplates: MessageTemplate[] = [
  {
    id: "aniversario-carinho",
    label: "Carinhosa",
    body:
      `Feliz aniversário, {nome}! 🎉 Que seu dia seja lindo como você. ` +
      `Aqui do ${studio.name} a gente te deseja tudo de bom — e já fica o convite para ` +
      `comemorar com aquele look de cílios impecável. 💛`,
  },
  {
    id: "aniversario-mimo",
    label: "Com mimo",
    body:
      `Parabéns, {nome}! 🥳 No mês do seu aniversário você merece um mimo especial: ` +
      `me chama aqui para a gente marcar seu horário com um miminho de presente. ` +
      `Bora comemorar bonita? ✨`,
  },
];

export const winbackTemplates: MessageTemplate[] = [
  {
    id: "saudade-simples",
    label: "Sentimos saudade",
    body:
      `Oi, {nome}! Faz um tempinho que você não aparece aqui no ${studio.name} e a gente ` +
      `ficou com saudade. 💛 Que tal marcar um horário para renovar os cílios? ` +
      `É só me chamar que encaixo você.`,
  },
  {
    id: "saudade-condicao",
    label: "Com condição de retorno",
    body:
      `Oi, {nome}! Sumida, né? 😊 Preparei uma condição especial de retorno para você ` +
      `voltar a brilhar com a gente no ${studio.name}. Me chama para eu te contar e ` +
      `já reservar seu horário!`,
  },
];

export const generalTemplates: MessageTemplate[] = [
  {
    id: "aviso-geral",
    label: "Comunicado",
    body: `Oi, {nome}! Passando para avisar: `,
  },
  {
    id: "novidade",
    label: "Novidade",
    body:
      `Oi, {nome}! 💛 Chegou novidade aqui no ${studio.name} e eu já pensei em você. ` +
      `Me chama que te conto tudo e a gente marca seu horário!`,
  },
];

/** Troca `{nome}` pelo primeiro nome da cliente. */
export function fillTemplate(body: string, fullName: string): string {
  const firstName = fullName.trim().split(/\s+/)[0] ?? fullName;
  return body.replaceAll("{nome}", firstName);
}
