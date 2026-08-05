import { z } from "zod";
import { defineRoute } from "@/core/api/handler";
import { unsubscribe } from "@/modules/notifications/push.service";

/** POST /api/v1/push/unsubscribe — desliga este aparelho. */
export const POST = defineRoute(
  { body: z.object({ endpoint: z.url() }), roles: ["OWNER", "PRO"] },
  async ({ body }) => {
    await unsubscribe(body.endpoint);
  },
);
