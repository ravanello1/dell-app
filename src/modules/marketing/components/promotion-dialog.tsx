"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/core/api/client";
import { Button } from "@/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/ui/dialog";
import { Field, Input, Textarea } from "@/ui/field";
import { useCreatePromotion, useUpdatePromotion } from "../marketing.api";
import type { PromotionDto } from "../marketing.dto";

/**
 * Cria ou edita uma promoção. Use `{nome}` no texto — na hora de enviar, ele
 * vira o primeiro nome da cliente. A `key` de quem monta remonta o diálogo com
 * valores novos, sem efeito para resetar estado.
 */
export function PromotionDialog({
  open,
  onOpenChange,
  promotion,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotion?: PromotionDto;
}) {
  const isEditing = Boolean(promotion);
  const createMutation = useCreatePromotion();
  const updateMutation = useUpdatePromotion(promotion?.id ?? "");

  const [title, setTitle] = useState(promotion?.title ?? "");
  const [message, setMessage] = useState(
    promotion?.message ??
      "Oi, {nome}! 💛 Preparei uma condição especial para você: ",
  );
  const [error, setError] = useState<string | null>(null);

  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (title.trim().length < 2) return setError("Dê um título à promoção.");
    if (message.trim().length < 4) return setError("Escreva a mensagem da promoção.");

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ title: title.trim(), message: message.trim() });
        toast.success("Promoção atualizada.");
      } else {
        await createMutation.mutateAsync({ title: title.trim(), message: message.trim(), active: true });
        toast.success("Promoção criada.");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEditing ? "Editar promoção" : "Nova promoção"}
        description="A mensagem é enviada por WhatsApp, uma cliente por vez."
        footer={
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" form="promotion-form" loading={isPending}>
              {isEditing ? "Salvar" : "Criar promoção"}
            </Button>
          </div>
        }
      >
        <form id="promotion-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Título" hint="Só para você identificar" required>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: 20% no volume russo em julho"
              maxLength={80}
              autoFocus
            />
          </Field>

          <Field
            label="Mensagem"
            hint="Use {nome} para o primeiro nome da cliente"
            error={error ?? undefined}
            required
          >
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={1000}
            />
          </Field>

          <p className="rounded-(--radius-field) bg-surface-muted p-3 text-xs text-ink-500">
            Prévia: {message.replaceAll("{nome}", "Camila")}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
