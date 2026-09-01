import { z } from "zod";
import { booleanFlag, optionalDateOnly, optionalEnum, optionalText } from "@/core/api/dto";
import { productCategories, productUnits } from "./product.schema";
import { stockMovementTypes } from "./stock-movement.schema";

/** Contrato de dados do módulo de estoque. */

export const createProductSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do produto.").max(120),
  brand: optionalText(80),
  category: z.enum(productCategories).default("OUTRO"),
  /** Especificação livre: "C 0.07 · 11mm", "volume russo 0.05". */
  spec: optionalText(80),
  sku: optionalText(60),
  unit: z.enum(productUnits).default("UN"),
  /** Quantidade inicial — vira o primeiro movimento de entrada. */
  initialQty: z.coerce.number().min(0, "A quantidade não pode ser negativa.").default(0),
  minQty: z.coerce.number().min(0, "O mínimo não pode ser negativo.").default(0),
  // Mantém a ausência do campo até o service autorizar sua escrita. Um
  // `default(0)` aqui apagaria a diferença entre custo omitido e enviado pela
  // API, permitindo que perfis sem essa permissão contornassem a regra.
  costCents: z.coerce.number().int().min(0).optional(),
  expiresAt: optionalDateOnly,
  notes: optionalText(500),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  brand: optionalText(80),
  category: optionalEnum(productCategories),
  spec: optionalText(80),
  sku: optionalText(60),
  unit: optionalEnum(productUnits),
  minQty: z.coerce.number().min(0).optional(),
  costCents: z.coerce.number().int().min(0).optional(),
  expiresAt: optionalDateOnly,
  notes: optionalText(500),
  active: z.boolean().optional(),
});

export const productQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: optionalEnum(productCategories),
  /** Só o que está abaixo do mínimo — a lista de compras. */
  lowStockOnly: booleanFlag(false),
  includeInactive: booleanFlag(false),
  sort: z.enum(["name", "qty", "category"]).default("name"),
});

export type ProductQuery = z.infer<typeof productQuerySchema>;

/**
 * Registro de movimento.
 *
 * `quantity` é sempre positiva; o sinal vem do tipo. Em ADJUST a quantidade
 * significa outra coisa: é o saldo REAL contado na prateleira, e o sistema
 * calcula sozinho a diferença. Foi a modelagem que sobreviveu à pergunta
 * "como alguém explica isso para quem está conferindo o estoque?".
 */
export const createMovementSchema = z.object({
  productId: z.string().min(1, "Escolha o produto."),
  type: z.enum(stockMovementTypes),
  quantity: z.coerce.number().min(0, "Informe uma quantidade válida."),
  reason: optionalText(200),
  unitCostCents: z.coerce.number().int().min(0).optional(),
  appointmentId: z.string().optional(),
});

export interface ProductDto {
  id: string;
  name: string;
  brand: string | null;
  category: (typeof productCategories)[number];
  spec: string | null;
  sku: string | null;
  unit: (typeof productUnits)[number];
  currentQty: number;
  minQty: number;
  /** Abaixo ou igual ao mínimo — precisa repor. */
  isLow: boolean;
  /** Saldo zerado. */
  isOut: boolean;
  /** Custo só é exposto para a proprietária. */
  costCents?: number;
  totalValueCents?: number;
  expiresAt: string | null;
  /** Vence nos próximos 60 dias. */
  isExpiringSoon: boolean;
  isExpired: boolean;
  notes: string | null;
  active: boolean;
  updatedAt: string;
}

export interface StockMovementDto {
  id: string;
  type: (typeof stockMovementTypes)[number];
  qtyDelta: number;
  balanceAfter: number;
  reason: string | null;
  unitCostCents: number | null;
  occurredAt: string;
  userName: string | null;
}
