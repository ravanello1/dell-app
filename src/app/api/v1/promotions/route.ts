import { NextResponse } from "next/server";
import { defineRoute } from "@/core/api/handler";
import { createPromotionSchema } from "@/modules/marketing/marketing.dto";
import { createPromotion, listPromotions } from "@/modules/marketing/marketing.service";

/** GET /api/v1/promotions — promoções salvas. */
export const GET = defineRoute({}, () => listPromotions());

/** POST /api/v1/promotions — cria uma promoção. */
export const POST = defineRoute({ body: createPromotionSchema }, async ({ body, session }) => {
  const promotion = await createPromotion(body, session);
  return NextResponse.json({ data: promotion }, { status: 201 });
});
