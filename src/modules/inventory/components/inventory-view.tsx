"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CalendarX,
  Package,
  PackagePlus,
  Pencil,
  Search,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/core/utils/cn";
import { formatCents } from "@/core/utils/money";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/ui/feedback";
import { useProducts } from "../inventory.api";
import { MovementDialog } from "./movement-dialog";
import { ProductFormDialog } from "./product-form-dialog";
import { productCategories, productCategoryLabels, productUnitLabels } from "../product.schema";
import type { ProductDto } from "../inventory.dto";

/**
 * Tela de estoque.
 *
 * A pergunta que ela responde primeiro é "o que preciso comprar?" — por isso o
 * alerta de reposição vem antes da lista completa, e o filtro de estoque baixo é
 * um clique. Saldo e mínimo aparecem lado a lado em toda linha, porque um número
 * sozinho não diz se está bom ou ruim.
 */
export function InventoryView({ canSeeCosts }: { canSeeCosts: boolean }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [selected, setSelected] = useState<ProductDto | undefined>();

  const deferredSearch = useDeferredValue(search);

  const query = useProducts({
    q: deferredSearch || undefined,
    category: category || undefined,
    lowStockOnly,
    sort: lowStockOnly ? "qty" : "name",
  });

  const products = useMemo(() => query.data ?? [], [query.data]);
  const lowStock = useMemo(() => products.filter((product) => product.isLow), [products]);

  const totalValue = useMemo(
    () => products.reduce((sum, product) => sum + (product.totalValueCents ?? 0), 0),
    [products],
  );

  function openNew() {
    setSelected(undefined);
    setFormOpen(true);
  }

  function openEdit(product: ProductDto) {
    setSelected(product);
    setFormOpen(true);
  }

  function openMovement(product: ProductDto) {
    setSelected(product);
    setMovementOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Alerta de reposição ────────────────────────────────────────── */}
      {!lowStockOnly && lowStock.length > 0 && (
        <button
          type="button"
          onClick={() => setLowStockOnly(true)}
          className="flex items-center gap-3 rounded-(--radius-card) border border-warning/30 bg-warning-soft px-4 py-3 text-left transition-colors hover:brightness-[0.98]"
        >
          <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-warning">
              {lowStock.length}{" "}
              {lowStock.length === 1 ? "produto precisa" : "produtos precisam"} de reposição
            </span>
            <span className="mt-0.5 block truncate text-xs text-ink-600">
              {lowStock
                .slice(0, 3)
                .map((product) => product.name)
                .join(" · ")}
              {lowStock.length > 3 && ` · +${lowStock.length - 3}`}
            </span>
          </span>
          <span className="shrink-0 text-xs font-medium text-warning">Ver lista →</span>
        </button>
      )}

      {/* ── Filtros ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-gold-600"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar produto, marca ou especificação…"
            aria-label="Buscar produto"
            className="w-full rounded-(--radius-field) border border-line-strong bg-surface py-2.5 pl-10 pr-3 text-[16px] leading-tight text-ink-900 placeholder:text-ink-400 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-200 sm:text-sm"
          />
        </div>

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filtrar por categoria"
          className="rounded-(--radius-field) border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink-700"
        >
          <option value="">Todas as categorias</option>
          {productCategories.map((option) => (
            <option key={option} value={option}>
              {productCategoryLabels[option]}
            </option>
          ))}
        </select>

        <Button
          variant={lowStockOnly ? "primary" : "secondary"}
          onClick={() => setLowStockOnly((current) => !current)}
          aria-pressed={lowStockOnly}
        >
          <TriangleAlert className="size-4" aria-hidden />
          Repor
        </Button>

        <Button onClick={openNew}>
          <PackagePlus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Novo produto</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      {query.isError && (
        <ErrorState
          message={query.error.message}
          retry={
            <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      )}

      {/* ── Lista ──────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        {query.isPending ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Package className="size-6" aria-hidden />}
            title={lowStockOnly ? "Nada para repor" : "Estoque vazio"}
            description={
              lowStockOnly
                ? "Todos os produtos estão acima do mínimo. "
                : "Cadastre os produtos que o studio usa para acompanhar o consumo."
            }
            action={
              lowStockOnly ? (
                <Button variant="secondary" onClick={() => setLowStockOnly(false)}>
                  Ver todo o estoque
                </Button>
              ) : (
                <Button onClick={openNew}>
                  <PackagePlus className="size-4" aria-hidden />
                  Novo produto
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {products.map((product) => (
              <li
                key={product.id}
                className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-gold-50/60 sm:px-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-medium text-ink-900">{product.name}</span>
                    {product.spec && (
                      <span className="shrink-0 text-sm text-ink-600">{product.spec}</span>
                    )}
                    {product.isOut ? (
                      <Badge tone="danger">Acabou</Badge>
                    ) : product.isLow ? (
                      <Badge tone="warning">Repor</Badge>
                    ) : null}
                    {product.isExpired && (
                      <Badge tone="danger">
                        <CalendarX className="size-3" aria-hidden />
                        Vencido
                      </Badge>
                    )}
                    {product.isExpiringSoon && !product.isExpired && (
                      <Badge tone="warning">Vence em breve</Badge>
                    )}
                  </div>

                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-600">
                    <span>{productCategoryLabels[product.category]}</span>
                    {product.brand && <span className="text-ink-400">{product.brand}</span>}
                    {canSeeCosts && product.costCents !== undefined && product.costCents > 0 && (
                      <span className="text-ink-400">{formatCents(product.costCents)} / un.</span>
                    )}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  {/* O `aria-label` existe porque o texto puro sai grudado
                      ("6unidade") num leitor de tela. */}
                  <p
                    aria-label={`Saldo: ${product.currentQty} ${productUnitLabels[product.unit]}`}
                    className={cn(
                      "text-base font-semibold tabular-nums",
                      product.isOut
                        ? "text-danger"
                        : product.isLow
                          ? "text-warning"
                          : "text-ink-900",
                    )}
                  >
                    {product.currentQty}
                    <span className="ml-1 text-xs font-normal text-ink-400">
                      {productUnitLabels[product.unit]}
                    </span>
                  </p>
                  <p className="text-[11px] text-ink-400">mín. {product.minQty}</p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => openMovement(product)}
                    aria-label={`Movimentar ${product.name}`}
                    className="rounded-full p-2 text-gold-700 transition-colors hover:bg-gold-100"
                  >
                    <ArrowLeftRight className="size-[18px]" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(product)}
                    aria-label={`Editar ${product.name}`}
                    className="rounded-full p-2 text-ink-600 transition-colors hover:bg-gold-100 hover:text-gold-800"
                  >
                    <Pencil className="size-[18px]" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canSeeCosts && products.length > 0 && totalValue > 0 && (
        <p className="px-1 text-sm text-ink-600">
          Valor em estoque:{" "}
          <strong className="tabular-nums text-ink-900">{formatCents(totalValue)}</strong>
          <span className="ml-2 text-ink-400">
            ({products.length} {products.length === 1 ? "produto" : "produtos"})
          </span>
        </p>
      )}

      {/* `key` remonta o diálogo a cada abertura, com os valores certos. */}
      <ProductFormDialog
        key={`produto-${selected?.id ?? "novo"}-${String(formOpen)}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        product={selected}
        canSeeCosts={canSeeCosts}
      />

      {selected && (
        <MovementDialog
          key={`movimento-${selected.id}-${String(movementOpen)}`}
          open={movementOpen}
          onOpenChange={setMovementOpen}
          product={selected}
        />
      )}
    </div>
  );
}
