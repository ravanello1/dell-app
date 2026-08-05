import { idParamSchema } from "@/core/api/dto";
import { defineRoute } from "@/core/api/handler";
import { updateProductSchema } from "@/modules/inventory/inventory.dto";
import { getProduct, updateProduct } from "@/modules/inventory/inventory.service";

export const GET = defineRoute({ params: idParamSchema }, ({ params, session }) =>
  getProduct(params.id, session),
);

export const PATCH = defineRoute(
  { params: idParamSchema, body: updateProductSchema },
  ({ params, body, session }) => updateProduct(params.id, body, session),
);
