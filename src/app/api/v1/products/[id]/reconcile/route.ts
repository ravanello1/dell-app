import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { reconcileProduct } from "@/modules/inventory/inventory.service";

/**
 * POST /api/v1/products/:id/reconcile — refaz o saldo a partir do razão.
 * Rede de segurança operada pela proprietária, não rotina do dia a dia.
 */
export const POST = defineRoute(
  { params: idParamSchema, roles: ["OWNER"] },
  ({ params, session }) => reconcileProduct(params.id, session),
);
