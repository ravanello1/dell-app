"use client";

import { useState } from "react";
import { Pencil, Plus, Sparkles, UserCog } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/core/api/client";
import { cn } from "@/core/utils/cn";
import { formatDuration } from "@/core/utils/date";
import { centsToInput, formatCents, inputToCents } from "@/core/utils/money";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardHeader } from "@/ui/card";
import { Dialog, DialogClose, DialogContent } from "@/ui/dialog";
import { Field, Input, Select, Textarea } from "@/ui/field";
import { LoadingBlock } from "@/ui/feedback";
import {
  useCreateProfessional,
  useCreateService,
  useProfessionals,
  useServices,
  useUpdateProfessional,
  useUpdateService,
} from "../agenda.api";
import { serviceCategories, serviceCategoryLabels } from "../service.schema";
import type { ProfessionalDto, ServiceDto } from "../agenda.dto";

/**
 * Ajustes do studio: a tabela de procedimentos e quem atende.
 *
 * São os dois cadastros que a agenda consome — mexer aqui muda o que aparece no
 * formulário de agendamento, então a tela fica restrita à proprietária.
 */

/** Paleta pronta para os cards da agenda — evita o usuário escolher um tom
 *  ilegível sobre o fundo claro. */
const PALETTE = [
  "#be3f6c",
  "#c9a227",
  "#2c6e9b",
  "#2e7d5b",
  "#9c3057",
  "#b4690e",
  "#6b5f5a",
  "#8a6d18",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-label={`Cor ${color}`}
          aria-pressed={value === color}
          className={cn(
            "size-8 rounded-full ring-offset-2 transition-all",
            value === color ? "ring-2 ring-ink-900" : "ring-1 ring-line-strong hover:scale-110",
          )}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

// ── Procedimentos ─────────────────────────────────────────────────────────────

function ServiceDialog({
  open,
  onOpenChange,
  service,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: ServiceDto;
}) {
  const isEditing = Boolean(service);
  const createMutation = useCreateService();
  const updateMutation = useUpdateService();

  const [name, setName] = useState(service?.name ?? "");
  const [category, setCategory] = useState<string>(service?.category ?? "CILIOS");
  const [duration, setDuration] = useState(String(service?.durationMin ?? 60));
  const [price, setPrice] = useState(service ? centsToInput(service.priceCents) : "");
  const [color, setColor] = useState(service?.color ?? "#be3f6c");
  const [description, setDescription] = useState(service?.description ?? "");
  const [active, setActive] = useState(service?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const payload = {
      name,
      category,
      durationMin: Number(duration),
      priceCents: inputToCents(price) ?? 0,
      color,
      description: description || null,
      active,
    };

    try {
      if (isEditing && service) {
        await updateMutation.mutateAsync({ id: service.id, input: payload });
        toast.success("Procedimento atualizado.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Procedimento cadastrado.");
      }
      onOpenChange(false);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        return;
      }
      toast.error("Não foi possível salvar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEditing ? "Editar procedimento" : "Novo procedimento"}
        description="Duração e preço abastecem a agenda automaticamente"
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              form="service-form"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              Salvar
            </Button>
          </>
        }
      >
        <form id="service-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p
              role="alert"
              className="rounded-(--radius-field) border border-danger/25 bg-danger-soft px-3 py-2.5 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <Field label="Nome" required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Volume Brasileiro"
              autoFocus
            />
          </Field>

          <Field label="Categoria">
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              {serviceCategories.map((option) => (
                <option key={option} value={option}>
                  {serviceCategoryLabels[option]}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Duração (minutos)" required hint="Define o bloco na agenda">
              <Input
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                inputMode="numeric"
                placeholder="120"
              />
            </Field>
            <Field label="Preço">
              <Input
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                inputMode="decimal"
                placeholder="180,00"
              />
            </Field>
          </div>

          <Field label="Cor na agenda">
            <ColorPicker value={color} onChange={setColor} />
          </Field>

          <Field label="Descrição">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
            />
          </Field>

          {isEditing && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
                className="size-4 rounded border-line-strong accent-rose-600"
              />
              Disponível para agendamento
            </label>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Profissionais ─────────────────────────────────────────────────────────────

function ProfessionalDialog({
  open,
  onOpenChange,
  professional,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional?: ProfessionalDto;
}) {
  const isEditing = Boolean(professional);
  const createMutation = useCreateProfessional();
  const updateMutation = useUpdateProfessional();

  const [name, setName] = useState(professional?.name ?? "");
  const [color, setColor] = useState(professional?.color ?? "#c9a227");
  const [phone, setPhone] = useState(professional?.phone ?? "");
  const [active, setActive] = useState(professional?.active ?? true);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const payload = { name, color, phone: phone || null, active };

    try {
      if (isEditing && professional) {
        await updateMutation.mutateAsync({ id: professional.id, input: payload });
        toast.success("Profissional atualizada.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Profissional cadastrada.");
      }
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEditing ? "Editar profissional" : "Nova profissional"}
        description="Cada uma ganha uma coluna própria na visão de dia"
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              form="professional-form"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              Salvar
            </Button>
          </>
        }
      >
        <form id="professional-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Nome" required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              placeholder="Nome de quem atende"
            />
          </Field>

          <Field label="Telefone">
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
          </Field>

          <Field label="Cor na agenda">
            <ColorPicker value={color} onChange={setColor} />
          </Field>

          {isEditing && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
                className="size-4 rounded border-line-strong accent-rose-600"
              />
              Atendendo no momento
            </label>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Tela ──────────────────────────────────────────────────────────────────────

export function SettingsView() {
  const servicesQuery = useServices(true);
  const professionalsQuery = useProfessionals(true);

  const [serviceDialog, setServiceDialog] = useState<{ open: boolean; service?: ServiceDto }>({
    open: false,
  });
  const [professionalDialog, setProfessionalDialog] = useState<{
    open: boolean;
    professional?: ProfessionalDto;
  }>({ open: false });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Procedimentos"
          description="Duração e preço usados na agenda"
          action={
            <Button size="sm" onClick={() => setServiceDialog({ open: true })}>
              <Plus className="size-4" aria-hidden />
              Novo
            </Button>
          }
        />

        {servicesQuery.isPending ? (
          <LoadingBlock />
        ) : (
          <ul className="divide-y divide-line">
            {(servicesQuery.data ?? []).map((service) => (
              <li key={service.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                  style={{ backgroundColor: service.color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-ink-900">{service.name}</span>
                    {!service.active && <Badge tone="neutral">Inativo</Badge>}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-600">
                    {serviceCategoryLabels[service.category]} ·{" "}
                    {formatDuration(service.durationMin)} · {formatCents(service.priceCents)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setServiceDialog({ open: true, service })}
                  aria-label={`Editar ${service.name}`}
                  className="rounded-full p-2 text-ink-600 transition-colors hover:bg-gold-100 hover:text-gold-800"
                >
                  <Pencil className="size-[18px]" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Profissionais"
          description="Quem atende — cada uma tem sua coluna na agenda"
          action={
            <Button size="sm" onClick={() => setProfessionalDialog({ open: true })}>
              <Plus className="size-4" aria-hidden />
              Nova
            </Button>
          }
        />

        {professionalsQuery.isPending ? (
          <LoadingBlock />
        ) : (
          <ul className="divide-y divide-line">
            {(professionalsQuery.data ?? []).map((professional) => (
              <li key={professional.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: professional.color }}
                >
                  <UserCog className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-ink-900">{professional.name}</span>
                    {!professional.active && <Badge tone="neutral">Inativa</Badge>}
                  </span>
                  {professional.phone && (
                    <span className="block text-xs text-ink-600">{professional.phone}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setProfessionalDialog({ open: true, professional })}
                  aria-label={`Editar ${professional.name}`}
                  className="rounded-full p-2 text-ink-600 transition-colors hover:bg-gold-100 hover:text-gold-800"
                >
                  <Pencil className="size-[18px]" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="flex items-start gap-2 px-1 text-xs text-ink-600">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-gold-500" aria-hidden />
        <span className="min-w-0">
          Desativar um procedimento tira ele do formulário de agendamento sem apagar o histórico. O
          sistema avisa se ainda houver horários futuros marcados com ele.
        </span>
      </p>

      {/* `key` força o formulário a remontar com os valores certos a cada abertura. */}
      <ServiceDialog
        key={`service-${serviceDialog.service?.id ?? "novo"}-${String(serviceDialog.open)}`}
        open={serviceDialog.open}
        onOpenChange={(open) => setServiceDialog((current) => ({ ...current, open }))}
        service={serviceDialog.service}
      />

      <ProfessionalDialog
        key={`professional-${professionalDialog.professional?.id ?? "novo"}-${String(professionalDialog.open)}`}
        open={professionalDialog.open}
        onOpenChange={(open) => setProfessionalDialog((current) => ({ ...current, open }))}
        professional={professionalDialog.professional}
      />
    </div>
  );
}
