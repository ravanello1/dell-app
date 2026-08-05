"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/core/api/client";
import { cn } from "@/core/utils/cn";
import { Button } from "@/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/ui/dialog";
import { Field, Input, Textarea } from "@/ui/field";
import { useRegisterMovement } from "../inventory.api";
import { productUnitLabels } from "../product.schema";
import type { StockMovementType } from "../stock-movement.schema";
import type { ProductDto } from "../inventory.dto";

/**
 * Registro de movimento.
 *
 * Os quatro tipos aparecem como botões grandes em vez de um select: quem está
 * conferindo estoque costuma estar de pé, com o celular numa mão e o produto na
 * outra. E cada tipo muda o rótulo do campo de quantidade, porque em "ajuste" o
 * número significa outra coisa — o saldo contado, não a variação.
 */

const TYPE_OPTIONS: Array<{
  value: StockMovementType;
  label: string;
  hint: string;
  icon: typeof ArrowDownToLine;
  className: string;
}> = [
  {
    value: "IN",
    label: "Entrada",
    hint: "Chegou compra ou reposição",
    icon: ArrowDownToLine,
    className: "data-[selected=true]:border-success data-[selected=true]:bg-success-soft",
  },
  {
    value: "OUT",
    label: "Saída",
    hint: "Usado em atendimento",
    icon: ArrowUpFromLine,
    className: "data-[selected=true]:border-info data-[selected=true]:bg-info-soft",
  },
  {
    value: "ADJUST",
    label: "Ajuste",
    hint: "Contei a prateleira",
    icon: ClipboardCheck,
    className: "data-[selected=true]:border-gold-500 data-[selected=true]:bg-gold-50",
  },
  {
    value: "LOSS",
    label: "Perda",
    hint: "Quebrou, venceu, secou",
    icon: TriangleAlert,
    className: "data-[selected=true]:border-danger data-[selected=true]:bg-danger-soft",
  },
];

export function MovementDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductDto;
}) {
  const mutation = useRegisterMovement();

  // Quem monta este diálogo passa uma `key` que muda a cada abertura, então o
  // componente remonta zerado — sem efeito de reset.
  const [type, setType] = useState<StockMovementType>("IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const unit = productUnitLabels[product.unit];
  const parsedQuantity = Number(quantity.replace(",", "."));
  const hasQuantity = quantity !== "" && Number.isFinite(parsedQuantity) && parsedQuantity >= 0;

  // Prévia do saldo — evita o "salvei e agora, quanto ficou?".
  const preview = hasQuantity
    ? type === "ADJUST"
      ? parsedQuantity
      : type === "IN"
        ? product.currentQty + parsedQuantity
        : product.currentQty - parsedQuantity
    : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!hasQuantity) {
      setError("Informe a quantidade.");
      return;
    }

    try {
      await mutation.mutateAsync({
        productId: product.id,
        type,
        quantity: parsedQuantity,
        reason: reason || null,
      });
      toast.success("Movimento registrado.");
      onOpenChange(false);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        return;
      }
      toast.error("Não foi possível registrar o movimento.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Movimentar estoque"
        description={`${product.name}${product.spec ? ` · ${product.spec}` : ""}`}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                Fechar
              </Button>
            </DialogClose>
            <Button type="submit" form="movement-form" loading={mutation.isPending}>
              Registrar
            </Button>
          </>
        }
      >
        <form id="movement-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="rounded-(--radius-field) bg-surface-sunken px-3 py-2.5 text-sm text-ink-700">
            Saldo atual:{" "}
            <strong className="tabular-nums text-ink-900">
              {product.currentQty} {unit}
            </strong>
            {product.isLow && (
              <span className="ml-2 text-warning">· abaixo do mínimo ({product.minQty})</span>
            )}
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-700">O que aconteceu?</legend>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  data-selected={type === option.value}
                  onClick={() => setType(option.value)}
                  aria-pressed={type === option.value}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-(--radius-field) border border-line-strong bg-surface px-3 py-2.5 text-left transition-colors",
                    "hover:border-gold-400",
                    option.className,
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                    <option.icon className="size-4" aria-hidden />
                    {option.label}
                  </span>
                  <span className="text-[11px] leading-tight text-ink-600">
                    {option.hint}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <Field
            label={type === "ADJUST" ? `Quantidade contada (${unit})` : `Quantidade (${unit})`}
            hint={
              type === "ADJUST"
                ? "O número que realmente existe na prateleira agora"
                : undefined
            }
            error={error ?? undefined}
            required
          >
            <Input
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              inputMode="decimal"
              placeholder="0"
              autoFocus
            />
          </Field>

          {preview !== null && (
            <p
              className={cn(
                "rounded-(--radius-field) px-3 py-2 text-sm",
                preview < 0
                  ? "bg-danger-soft text-danger"
                  : preview <= product.minQty
                    ? "bg-warning-soft text-warning"
                    : "bg-success-soft text-success",
              )}
            >
              Saldo depois:{" "}
              <strong className="tabular-nums">
                {Math.round(preview * 1000) / 1000} {unit}
              </strong>
              {preview < 0 && " — não é possível ficar negativo"}
              {preview >= 0 && preview <= product.minQty && " — ficará abaixo do mínimo"}
            </p>
          )}

          <Field label="Motivo" hint="Opcional, mas ajuda a entender o extrato depois">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              placeholder={
                type === "IN"
                  ? "Compra na fornecedora X"
                  : type === "OUT"
                    ? "Atendimento da tarde"
                    : type === "LOSS"
                      ? "Frasco quebrou"
                      : "Contagem do fim do mês"
              }
            />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
