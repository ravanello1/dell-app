"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  ExternalLink,
  MessageCircle,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/core/api/client";
import { studio } from "@/core/config/studio";
import {
  addMinutes,
  formatDuration,
  studioWallTimeToInstant,
  toDateInputValue,
  toTimeInputValue,
} from "@/core/utils/date";
import { centsToInput, formatCents, inputToCents } from "@/core/utils/money";
import { whatsappLink } from "@/core/utils/phone";
import { Button } from "@/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/ui/dialog";
import { Field, Input, Select, Textarea } from "@/ui/field";
import { Badge } from "@/ui/badge";
import { useClientList } from "@/modules/clients/client.api";
import {
  useCreateAppointment,
  useMarkReminderSent,
  useProfessionals,
  useServices,
  useUpdateAppointment,
} from "../agenda.api";
import { buildReminderMessage } from "../agenda.messages";
import { selectableStatuses, statusStyles } from "../agenda.presentation";
import type { AppointmentDto } from "../agenda.dto";
import type { AppointmentStatus } from "../appointment.schema";

/**
 * Marcar e editar um atendimento.
 *
 * A checagem de conflito é do servidor — só ele enxerga a agenda inteira no
 * momento exato do salvamento. Quando ele recusa, a mensagem já vem dizendo com
 * quem o horário bate, e é isso que aparece no campo de horário.
 */

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ausente = novo agendamento. */
  appointment?: AppointmentDto;
  /** Horário sugerido ao clicar num espaço vago da grade. */
  suggestedStart?: Date;
  suggestedProfessionalId?: string;
  /** Pré-seleciona a cliente ao agendar a partir da ficha dela. */
  fixedClientId?: string;
}

export function AppointmentDialog({
  open,
  onOpenChange,
  appointment,
  suggestedStart,
  suggestedProfessionalId,
  fixedClientId,
}: AppointmentDialogProps) {
  const isEditing = Boolean(appointment);

  const servicesQuery = useServices();
  const professionalsQuery = useProfessionals();
  const [clientSearch, setClientSearch] = useState("");
  const clientsQuery = useClientList({ q: clientSearch || undefined, perPage: 30 });

  const createMutation = useCreateAppointment();
  const updateMutation = useUpdateAppointment();
  const reminderMutation = useMarkReminderSent();

  // O estado inicial vem dos props uma única vez. Quem monta este diálogo passa
  // uma `key` que muda a cada abertura, então o componente remonta com os
  // valores certos.
  const initialStart = appointment ? new Date(appointment.startAt) : (suggestedStart ?? new Date());

  const initialServiceIds = useMemo(() => {
    if (!appointment) return [];
    if (appointment.services && appointment.services.length > 0) {
      return appointment.services.map((s) => s.id);
    }
    return appointment.service?.id ? [appointment.service.id] : [];
  }, [appointment]);

  const [clientId, setClientId] = useState(appointment?.client.id ?? fixedClientId ?? "");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(initialServiceIds);
  const [serviceToAdd, setServiceToAdd] = useState("");
  const [professionalId, setProfessionalId] = useState(
    appointment?.professional.id ?? suggestedProfessionalId ?? "",
  );
  const [date, setDate] = useState(toDateInputValue(initialStart));
  const [time, setTime] = useState(toTimeInputValue(initialStart));
  const [priceOverride, setPriceOverride] = useState<string | null>(
    appointment ? centsToInput(appointment.priceCents) : null,
  );
  const [status, setStatus] = useState<AppointmentStatus>(appointment?.status ?? "SCHEDULED");
  const [notes, setNotes] = useState(appointment?.notes ?? "");
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const professionals = useMemo(() => professionalsQuery.data ?? [], [professionalsQuery.data]);
  const clients = clientsQuery.data?.items ?? [];

  const selectedServices = useMemo(() => {
    return selectedServiceIds
      .map((id) => services.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined);
  }, [selectedServiceIds, services]);

  const totalDurationMin = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + s.durationMin, 0);
  }, [selectedServices]);

  const totalDefaultPriceCents = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + s.priceCents, 0);
  }, [selectedServices]);

  // Sem profissional escolhida, assume a primeira — no caso mais comum do
  // studio só existe uma, e não faz sentido obrigar a escolha.
  const effectiveProfessionalId = professionalId || (professionals[0]?.id ?? "");

  // O preço acompanha a soma dos procedimentos até alguém digitar outro valor.
  const price =
    priceOverride ?? (selectedServices.length > 0 ? centsToInput(totalDefaultPriceCents) : "");

  const previewEnd = useMemo(() => {
    if (!date || !time || totalDurationMin <= 0) return null;
    const start = studioWallTimeToInstant(date, time);
    return addMinutes(start, totalDurationMin);
  }, [date, time, totalDurationMin]);

  function handleAddService(serviceId: string) {
    if (!serviceId) return;
    setSelectedServiceIds((prev) => [...prev, serviceId]);
    setServiceToAdd("");
  }

  function handleRemoveService(indexToRemove: number) {
    setSelectedServiceIds((prev) => prev.filter((_, index) => index !== indexToRemove));
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setConflictMessage(null);

    if (selectedServiceIds.length === 0) {
      toast.error("Selecione pelo menos um procedimento.");
      return;
    }

    if (!clientId || !effectiveProfessionalId || !date || !time) {
      toast.error("Preencha cliente, profissional, data e horário.");
      return;
    }

    const startAt = studioWallTimeToInstant(date, time).toISOString();
    const priceCents = inputToCents(price);

    try {
      if (isEditing && appointment) {
        await updateMutation.mutateAsync({
          id: appointment.id,
          input: {
            clientId,
            serviceIds: selectedServiceIds,
            professionalId: effectiveProfessionalId,
            startAt,
            status,
            notes: notes || null,
            ...(priceCents !== null && { priceCents }),
          },
        });
        toast.success("Agendamento atualizado.");
      } else {
        await createMutation.mutateAsync({
          clientId,
          serviceIds: selectedServiceIds,
          professionalId: effectiveProfessionalId,
          startAt,
          status,
          notes: notes || null,
          ...(priceCents !== null && { priceCents }),
        });
        toast.success("Atendimento marcado.");
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "CONFLICT") {
          setConflictMessage(error.message);
          return;
        }
        toast.error(error.message);
        return;
      }
      toast.error("Não foi possível salvar o agendamento.");
    }
  }

  async function handleSendReminder() {
    if (!appointment) return;
    const message = buildReminderMessage(appointment, studio.name);
    window.open(whatsappLink(appointment.client.phone, message), "_blank", "noopener");
    try {
      await reminderMutation.mutateAsync(appointment.id);
    } catch {
      // O WhatsApp já abriu; falhar em registrar a marca não é motivo de alarme.
    }
  }

  async function handleCancel() {
    if (!appointment) return;
    try {
      await updateMutation.mutateAsync({
        id: appointment.id,
        input: { status: "CANCELED" },
      });
      toast.success("Atendimento cancelado. O horário voltou a ficar livre.");
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível cancelar.");
    }
  }

  const serviceDescription = useMemo(() => {
    if (!appointment) return "Escolha a cliente, os procedimentos e o horário";
    const names =
      appointment.services && appointment.services.length > 0
        ? appointment.services.map((s) => s.name).join(" + ")
        : appointment.service.name;
    return `${appointment.client.name} · ${names}`;
  }, [appointment]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEditing ? "Atendimento" : "Novo atendimento"}
        description={serviceDescription}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                Fechar
              </Button>
            </DialogClose>
            <Button type="submit" form="appointment-form" loading={isPending}>
              {isEditing ? "Salvar" : "Marcar atendimento"}
            </Button>
          </>
        }
      >
        <form id="appointment-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {conflictMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-(--radius-field) border border-danger/25 bg-danger-soft px-3 py-2.5 text-sm text-danger"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">Horário ocupado</p>
                <p className="mt-0.5">{conflictMessage}</p>
              </div>
            </div>
          )}

          <Field label="Cliente" required>
            {fixedClientId ? (
              <Input value={clients.find((c) => c.id === fixedClientId)?.name ?? ""} disabled />
            ) : (
              <>
                <input
                  type="search"
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                  placeholder="Buscar cliente pelo nome…"
                  aria-label="Buscar cliente"
                  className="mb-2 w-full rounded-(--radius-field) border border-line-strong bg-surface px-3 py-2 text-[16px] leading-tight sm:text-sm"
                />
                <Select value={clientId} onChange={(event) => setClientId(event.target.value)}>
                  <option value="">Selecione a cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} — {client.phoneFormatted}
                    </option>
                  ))}
                </Select>
              </>
            )}
          </Field>

          <Field
            label="Procedimentos"
            required
            hint={
              selectedServices.length > 1
                ? `${selectedServices.length} procedimentos somando ${formatDuration(totalDurationMin)}`
                : undefined
            }
          >
            {selectedServices.length > 0 && (
              <div className="mb-2 flex flex-col gap-1.5">
                {selectedServices.map((service, index) => (
                  <div
                    key={`${service.id}-${index}`}
                    className="flex items-center justify-between rounded-(--radius-field) border border-line bg-surface-muted px-3 py-2 text-sm transition-colors hover:border-line-strong"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: service.color }}
                        aria-hidden
                      />
                      <span className="truncate font-medium text-ink-900">{service.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-ink-600">
                        {formatDuration(service.durationMin)} · {formatCents(service.priceCents)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveService(index)}
                      className="ml-2 shrink-0 rounded p-1 text-ink-400 transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                      title="Remover procedimento"
                      aria-label={`Remover ${service.name}`}
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Select
                value={serviceToAdd}
                onChange={(event) => {
                  if (event.target.value) {
                    handleAddService(event.target.value);
                  }
                }}
              >
                <option value="">
                  {selectedServices.length === 0
                    ? "Selecione o primeiro procedimento"
                    : "+ Adicionar outro procedimento"}
                </option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {formatDuration(service.durationMin)} ·{" "}
                    {formatCents(service.priceCents)}
                  </option>
                ))}
              </Select>
            </div>
          </Field>

          <Field label="Profissional" required>
            <Select
              value={effectiveProfessionalId}
              onChange={(event) => setProfessionalId(event.target.value)}
            >
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" required>
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Início" required>
              <Input
                type="time"
                step={300}
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </Field>
          </div>

          {previewEnd && selectedServices.length > 0 && (
            <div className="flex flex-col gap-1 rounded-(--radius-field) border border-gold-200/80 bg-gold-50 px-3 py-2.5 text-sm text-gold-900">
              <p className="flex items-center gap-1.5 font-medium text-gold-900">
                <CalendarClock className="size-4 shrink-0 text-gold-700" aria-hidden />
                Termina às {toTimeInputValue(previewEnd)} · Duração total:{" "}
                {formatDuration(totalDurationMin)}
              </p>
              {selectedServices.length > 1 && (
                <p className="pl-5.5 text-xs text-gold-800/85">
                  ({selectedServices.map((s) => `${s.name}: ${formatDuration(s.durationMin)}`).join(" · ")})
                </p>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Valor Total"
              hint={
                selectedServices.length > 1
                  ? "Soma dos procedimentos; ajuste se combinar desconto"
                  : "Já vem do procedimento; ajuste se combinar outro"
              }
            >
              <Input
                value={price}
                onChange={(event) => setPriceOverride(event.target.value)}
                inputMode="decimal"
                placeholder="180,00"
              />
            </Field>

            <Field label="Situação">
              <Select
                value={status}
                onChange={(event) => setStatus(event.target.value as AppointmentStatus)}
              >
                {selectableStatuses.map((option) => (
                  <option key={option} value={option}>
                    {statusStyles[option].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Observações">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Trouxe foto de referência, quer o canto externo mais aberto…"
            />
          </Field>

          {isEditing && appointment && (
            <div className="flex flex-col gap-3 border-t border-line pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={handleSendReminder}>
                  <MessageCircle className="size-4" aria-hidden />
                  {appointment.reminderSentAt ? "Enviar de novo" : "Confirmar por WhatsApp"}
                </Button>

                {appointment.reminderSentAt && (
                  <Badge tone="success">Lembrete já enviado</Badge>
                )}

                <Button asChild variant="ghost" size="sm">
                  <Link href={`/clientes/${appointment.client.id}`}>
                    <ExternalLink className="size-4" aria-hidden />
                    Abrir ficha
                  </Link>
                </Button>
              </div>

              {appointment.status !== "CANCELED" && (
                <Button
                  type="button"
                  variant="dangerGhost"
                  size="sm"
                  className="self-start"
                  onClick={handleCancel}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Cancelar atendimento
                </Button>
              )}
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

