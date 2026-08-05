import { defineRoute } from "@/core/api/handler";
import { pushSubscriptionSchema } from "@/modules/notifications/push.dto";
import { subscribe } from "@/modules/notifications/push.service";

/** POST /api/v1/push/subscribe — registra este aparelho para receber push. */
export const POST = defineRoute(
  { body: pushSubscriptionSchema, roles: ["OWNER", "PRO"] },
  async ({ body, session }) => {
    await subscribe(session, body);
  },
);
