import type { z } from "zod";
import { ConflictError, NotFoundError } from "@/core/api/errors";
import { canSeeCosts } from "@/core/auth/guard";
import type { SessionUser } from "@/core/auth/session";
import { toDateInputValue } from "@/core/utils/date";
import type {
  ProductDto,
  ProductQuery,
  StockMovementDto,
  createMovementSchema,
  createProductSchema,
  updateProductSchema,
} from "./inventory.dto";
import * as repository from "./inventory.repository";
import type { ProductRow } from "./product.schema";
import type { StockMovementType } from "./stock-movement.schema";

/**
 * Regras do estoque.
 *
 * O princípio que organiza o módulo: o razão de movimentos é a fonte da
 * verdade, e `products.current_qty` é só um cache para a listagem não precisar
 * somar o histórico inteiro a cada linha. Toda escrita passa por
 * `recordMovement`, que mantém os dois em transação — e `reconcile` existe para
 * o caso de algum dia divergirem.
 */

/** Quantidades em ponto flutuante acumulam resto; 3 casas bastam para ml e g. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

const EXPIRY_WARNING_DAYS = 60;

function toProductDto(row: ProductRow, user: SessionUser): ProductDto {
  const today = toDateInputValue(new Date());
  const warningLimit = toDateInputValue(
    new Date(Date.now() + EXPIRY_WARNING_DAYS * 86_400_000),
  );

  const dto: ProductDto = {
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    spec: row.spec,
    sku: row.sku,
    unit: row.unit,
    currentQty: round(row.currentQty),
    minQty: round(row.minQty),
    isLow: row.currentQty <= row.minQty,
    isOut: row.currentQty <= 0,
    expiresAt: row.expiresAt,
    // Datas "YYYY-MM-DD" comparam corretamente como texto — ordem lexicográfica
    // e cronológica coincidem nesse formato.
    isExpired: Boolean(row.expiresAt && row.expiresAt < today),
    isExpiringSoon: Boolean(
      row.expiresAt && row.expiresAt >= today && row.expiresAt <= warningLimit,
    ),
    notes: row.notes,
    active: row.active,
    updatedAt: row.updatedAt.toISOString(),
  };

  // Custo e valor imobilizado são informação de dona do negócio.
  if (canSeeCosts(user)) {
    dto.costCents = row.costCents;
    dto.totalValueCents = Math.round(row.costCents * row.currentQty);
  }

  return dto;
}

export async function listProducts(
  query: ProductQuery,
  user: SessionUser,
): Promise<ProductDto[]> {
  const rows = await repository.listProducts(query);
  return rows.map((row) => toProductDto(row, user));
}

export async function getProduct(id: string, user: SessionUser): Promise<ProductDto> {
  const row = await repository.findProductById(id);
  if (!row) throw new NotFoundError("Produto");
  return toProductDto(row, user);
}

export async function listLowStock(user: SessionUser): Promise<ProductDto[]> {
  const rows = await repository.listLowStock();
  return rows.map((row) => toProductDto(row, user));
}

export async function createProduct(
  input: z.output<typeof createProductSchema>,
  user: SessionUser,
): Promise<ProductDto> {
  const initialQty = round(input.initialQty);

  const row = await repository.insertProduct({
    name: input.name,
    brand: input.brand,
    category: input.category,
    spec: input.spec,
    sku: input.sku,
    unit: input.unit,
    currentQty: 0, // o saldo entra pelo movimento logo abaixo
    minQty: round(input.minQty),
    costCents: input.costCents,
    expiresAt: input.expiresAt,
    notes: input.notes,
  });

  // A quantidade inicial vira uma entrada no razão, e não um número solto:
  // o extrato do produto nasce coerente com o saldo desde a primeira linha.
  if (initialQty > 0) {
    await repository.recordMovement({
      productId: row.id,
      type: "IN",
      qtyDelta: initialQty,
      balanceAfter: initialQty,
      reason: "Cadastro inicial",
      unitCostCents: input.costCents || null,
      userId: user.id,
    });
    row.currentQty = initialQty;
  }

  return toProductDto(row, user);
}

export async function updateProduct(
  id: string,
  input: z.output<typeof updateProductSchema>,
  user: SessionUser,
): Promise<ProductDto> {
  const existing = await repository.findProductById(id);
  if (!existing) throw new NotFoundError("Produto");

  const row = await repository.updateProductRow(id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.brand !== undefined && { brand: input.brand }),
    ...(input.category !== null && input.category !== undefined && { category: input.category }),
    ...(input.spec !== undefined && { spec: input.spec }),
    ...(input.sku !== undefined && { sku: input.sku }),
    ...(input.unit !== null && input.unit !== undefined && { unit: input.unit }),
    ...(input.minQty !== undefined && { minQty: round(input.minQty) }),
    ...(input.costCents !== undefined && { costCents: input.costCents }),
    ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.active !== undefined && { active: input.active }),
  });

  if (!row) throw new NotFoundError("Produto");
  return toProductDto(row, user);
}

/**
 * Converte a intenção de quem opera numa variação de saldo.
 *
 * IN/OUT/LOSS movem o saldo; ADJUST o define. É a diferença entre "chegaram 3
 * caixas" e "contei a prateleira e tem 7" — as duas coisas acontecem no dia a
 * dia do studio e precisam de registros distintos.
 */
function computeDelta(
  type: StockMovementType,
  quantity: number,
  currentQty: number,
): number {
  switch (type) {
    case "IN":
      return round(quantity);
    case "OUT":
    case "LOSS":
      return round(-quantity);
    case "ADJUST":
      return round(quantity - currentQty);
  }
}

export async function registerMovement(
  input: z.output<typeof createMovementSchema>,
  user: SessionUser,
): Promise<ProductDto> {
  const product = await repository.findProductById(input.productId);
  if (!product) throw new NotFoundError("Produto");

  const delta = computeDelta(input.type, input.quantity, product.currentQty);
  const balanceAfter = round(product.currentQty + delta);

  // Saída maior que o saldo é recusada de propósito: quase sempre significa
  // que o cadastro está desatualizado, e o caminho certo é o ajuste de
  // inventário — que deixa registrado que houve uma contagem.
  if (balanceAfter < 0) {
    throw new ConflictError(
      `Saldo insuficiente: há ${round(product.currentQty)} ${product.unit.toLowerCase()} de ${product.name}. ` +
        `Se a prateleira mostra outro número, use "Ajuste de inventário".`,
      { quantity: ["Quantidade maior que o saldo disponível."] },
    );
  }

  if (delta === 0) {
    throw new ConflictError("Este movimento não altera o saldo.");
  }

  await repository.recordMovement({
    productId: product.id,
    type: input.type,
    qtyDelta: delta,
    balanceAfter,
    reason: input.reason,
    unitCostCents: input.unitCostCents ?? null,
    appointmentId: input.appointmentId ?? null,
    userId: user.id,
  });

  return getProduct(product.id, user);
}

export async function listMovements(productId: string): Promise<StockMovementDto[]> {
  const rows = await repository.listMovements(productId);
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    qtyDelta: round(row.qtyDelta),
    balanceAfter: round(row.balanceAfter),
    reason: row.reason,
    unitCostCents: row.unitCostCents,
    occurredAt: row.occurredAt.toISOString(),
    userName: row.userName,
  }));
}

/**
 * Reconcilia o saldo em cache com a soma do razão.
 *
 * Rede de segurança: se um dia os dois divergirem, esta rotina faz o razão
 * prevalecer, porque é ele que guarda a história de como se chegou ali.
 */
export async function reconcileProduct(
  productId: string,
  user: SessionUser,
): Promise<{ before: number; after: number; corrected: boolean }> {
  const product = await repository.findProductById(productId);
  if (!product) throw new NotFoundError("Produto");

  const ledgerTotal = round(await repository.sumMovements(productId));
  const before = round(product.currentQty);

  if (before === ledgerTotal) {
    return { before, after: before, corrected: false };
  }

  await repository.updateProductRow(productId, { currentQty: ledgerTotal });
  void user;
  return { before, after: ledgerTotal, corrected: true };
}

export async function getInventorySummary(): Promise<{ total: number; low: number }> {
  return repository.countProducts();
}
