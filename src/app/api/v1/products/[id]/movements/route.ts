import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { listMovements } from "@/modules/inventory/inventory.service";

/** GET /api/v1/products/:id/movements — extrato do produto. */
export const GET = defineRoute({ params: idParamSchema }, ({ params }) =>
  listMovements(params.id),
);
