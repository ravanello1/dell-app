"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/core/api/client";
import { centsToInput, inputToCents } from "@/core/utils/money";
import { Button } from "@/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/ui/dialog";
import { Field, Input, Select, Textarea } from "@/ui/field";
import { useCreateProduct, useUpdateProduct } from "../inventory.api";
import {
  productCategories,
  productCategoryLabels,
  productUnitLabels,
  productUnits,
} from "../product.schema";
import type { ProductDto } from "../inventory.dto";

/** Cadastro e edição de produto. Na criação, a quantidade inicial vira o
 *  primeiro movimento de entrada — sem número solto no cadastro. */
export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  canSeeCosts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductDto;
  canSeeCosts: boolean;
}) {
  const isEditing = Boolean(product);
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();

  // Estado inicial vindo dos props; a `key` de quem monta garante a remontagem
  // a cada abertura, no lugar de um efeito que reescreve todos os campos.
  const [name, setName] = useState(product?.name ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [spec, setSpec] = useState(product?.spec ?? "");
  const [category, setCategory] = useState<string>(product?.category ?? "CILIOS");
  const [unit, setUnit] = useState<string>(product?.unit ?? "UN");
  const [initialQty, setInitialQty] = useState("");
  const [minQty, setMinQty] = useState(String(product?.minQty ?? ""));
  const [cost, setCost] = useState(
    product?.costCents !== undefined ? centsToInput(product.costCents) : "",
  );
  const [expiresAt, setExpiresAt] = useState(product?.expiresAt ?? "");
  const [notes, setNotes] = useState(product?.notes ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldError(null);

    if (name.trim().length < 2) {
      setFieldError("Informe o nome do produto.");
      return;
    }

    const costCents = inputToCents(cost);

    try {
      if (isEditing && product) {
        await updateMutation.mutateAsync({
          id: product.id,
          input: {
            name,
            brand: brand || null,
            spec: spec || null,
            category,
            unit,
            minQty: Number(minQty.replace(",", ".")) || 0,
            expiresAt: expiresAt || null,
            notes: notes || null,
            ...(canSeeCosts && costCents !== null && { costCents }),
          },
        });
        toast.success("Produto atualizado.");
      } else {
        await createMutation.mutateAsync({
          name,
          brand: brand || null,
          spec: spec || null,
          category,
          unit,
          initialQty: Number(initialQty.replace(",", ".")) || 0,
          minQty: Number(minQty.replace(",", ".")) || 0,
          expiresAt: expiresAt || null,
          notes: notes || null,
          ...(costCents !== null && { costCents }),
        });
        toast.success("Produto cadastrado.");
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldError(error.message);
        return;
      }
      toast.error("Não foi possível salvar o produto.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEditing ? "Editar produto" : "Novo produto"}
        description={isEditing ? product?.name : "Cadastre o que o studio consome"}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" form="product-form" loading={isPending}>
              {isEditing ? "Salvar" : "Cadastrar"}
            </Button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {fieldError && (
            <p
              role="alert"
              className="rounded-(--radius-field) border border-danger/25 bg-danger-soft px-3 py-2.5 text-sm text-danger"
            >
              {fieldError}
            </p>
          )}

          <Field label="Nome" required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Cílios C 0.07"
              autoFocus
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Especificação" hint="Tamanho, curvatura, cor">
              <Input
                value={spec}
                onChange={(event) => setSpec(event.target.value)}
                placeholder="11mm"
              />
            </Field>
            <Field label="Marca">
              <Input value={brand} onChange={(event) => setBrand(event.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Categoria">
              <Select value={category} onChange={(event) => setCategory(event.target.value)}>
                {productCategories.map((option) => (
                  <option key={option} value={option}>
                    {productCategoryLabels[option]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Unidade">
              <Select value={unit} onChange={(event) => setUnit(event.target.value)}>
                {productUnits.map((option) => (
                  <option key={option} value={option}>
                    {productUnitLabels[option]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {!isEditing && (
              <Field label="Quantidade inicial" hint="Entra como primeiro movimento">
                <Input
                  value={initialQty}
                  onChange={(event) => setInitialQty(event.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
              </Field>
            )}
            <Field label="Estoque mínimo" hint="Abaixo disso, entra no alerta de reposição">
              <Input
                value={minQty}
                onChange={(event) => setMinQty(event.target.value)}
                inputMode="decimal"
                placeholder="2"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {canSeeCosts && (
              <Field label="Custo por unidade">
                <Input
                  value={cost}
                  onChange={(event) => setCost(event.target.value)}
                  inputMode="decimal"
                  placeholder="35,00"
                />
              </Field>
            )}
            <Field label="Validade">
              <Input
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Observações">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Fornecedora, prazo de entrega, cuidados…"
            />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
