import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { createPublicLink } from "@/modules/anamnese/anamnese.service";
import { procedureLabels } from "@/modules/anamnese/anamnese.questions";
import { getById } from "@/modules/anamnese/anamnese.service";
import { whatsappLink } from "@/core/utils/phone";
import { studio } from "@/core/config/studio";

/**
 * POST /api/v1/anamnese/:id/share — gera o link público e devolve o WhatsApp
 * pronto, com a mensagem e o número da cliente já preenchidos. O token só
 * trafega aqui e na URL; nunca é guardado em texto.
 */
export const POST = defineRoute(
  { params: idParamSchema, roles: ["OWNER", "PRO"] },
  async ({ params, session, request }) => {
    const anamnese = await getById(params.id, session);
    const { token, client } = await createPublicLink(params.id, session);

    // URL absoluta a partir da origem da requisição (funciona em dev e na Vercel).
    const url = `${request.nextUrl.origin}/f/${token}`;
    const firstName = client.name.trim().split(/\s+/)[0] ?? client.name;
    const procedure = procedureLabels[anamnese.procedure];

    const message =
      `Oi, ${firstName}! 💛 Aqui é do ${studio.name}. ` +
      `Antes do seu atendimento de ${procedure}, preencha sua ficha de anamnese neste link: ` +
      `${url}\n\nLeva uns 2 minutinhos. Qualquer dúvida, é só chamar!`;

    return {
      url,
      whatsappUrl: whatsappLink(client.phone, message),
    };
  },
);
