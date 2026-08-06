import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { updatePromotionSchema } from "@/modules/marketing/marketing.dto";
import { deletePromotion, updatePromotion } from "@/modules/marketing/marketing.service";

/** PATCH /api/v1/promotions/:id — edita título, mensagem ou status. */
export const PATCH = defineRoute(
  { params: idParamSchema, body: updatePromotionSchema },
  ({ params, body }) => updatePromotion(params.id, body),
);

/** DELETE /api/v1/promotions/:id — remove a promoção. */
export const DELETE = defineRoute({ params: idParamSchema }, async ({ params }) => {
  await deletePromotion(params.id);
});
