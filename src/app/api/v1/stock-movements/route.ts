import { NextResponse } from "next/server";
import { defineRoute } from "@/core/api/handler";
import { createMovementSchema } from "@/modules/inventory/inventory.dto";
import { registerMovement } from "@/modules/inventory/inventory.service";

/**
 * POST /api/v1/stock-movements — entrada, saída, perda ou ajuste.
 * Responde 409 quando a saída deixaria o saldo negativo.
 */
export const POST = defineRoute({ body: createMovementSchema }, async ({ body, session }) => {
  const product = await registerMovement(body, session);
  return NextResponse.json({ data: product }, { status: 201 });
});
