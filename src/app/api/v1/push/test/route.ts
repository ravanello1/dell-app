import { defineRoute } from "@/core/api/handler";
import { sendTest } from "@/modules/notifications/push.service";

/** POST /api/v1/push/test — manda uma notificação de teste para o próprio
 *  usuário, para conferir se está chegando neste aparelho. */
export const POST = defineRoute({ roles: ["OWNER", "PRO"] }, async ({ session }) => {
  return sendTest(session);
});
