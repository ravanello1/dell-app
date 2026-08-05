import { NextResponse } from "next/server";
import { defineRoute } from "@/core/api/handler";
import { createProductSchema, productQuerySchema } from "@/modules/inventory/inventory.dto";
import { createProduct, listProducts } from "@/modules/inventory/inventory.service";

export const GET = defineRoute({ query: productQuerySchema }, ({ query, session }) =>
  listProducts(query, session),
);

export const POST = defineRoute({ body: createProductSchema }, async ({ body, session }) => {
  const product = await createProduct(body, session);
  return NextResponse.json({ data: product }, { status: 201 });
});
