import type { z } from "zod";
import { BadRequestError, ConflictError, NotFoundError } from "@/core/api/errors";
import type { SessionUser } from "@/core/auth/session";
import { addMinutes, formatTime } from "@/core/utils/date";
import { formatPhone } from "@/core/utils/phone";
import type {
  AgendaRange,
  AppointmentDto,
  ProfessionalDto,
  ServiceDto,
  createAppointmentSchema,
  createProfessionalSchema,
  createServiceSchema,
  updateAppointmentSchema,
  updateProfessionalSchema,
  updateServiceSchema,
} from "./agenda.dto";
import * as repository from "./agenda.repository";
import type { AppointmentJoinedRow } from "./agenda.repository";
import type { ProfessionalRow } from "./professional.schema";
import type { ServiceRow } from "./service.schema";

/**
 * Regras da agenda.
 *
 * A mais importante é a de conflito: uma profissional não pode estar em dois
 * atendimentos ao mesmo tempo. A checagem acontece aqui, no serviço, e não num
 * índice único do banco — porque a colisão é de INTERVALO, não de valor, e
 * porque a mensagem de erro precisa dizer com quem o horário bate para a
 * recepção resolver na hora.
 */

// ── Apresentação ──────────────────────────────────────────────────────────────

function toServiceDto(row: ServiceRow): ServiceDto {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    durationMin: row.durationMin,
    priceCents: row.priceCents,
    color: row.color,
    description: row.description,
    active: row.active,
  };
}

function toProfessionalDto(row: ProfessionalRow): ProfessionalDto {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    phone: row.phone,
    active: row.active,
    sortOrder: row.sortOrder,
  };
}

function toAppointmentDto(row: AppointmentJoinedRow): AppointmentDto {
  return {
    id: row.id,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    status: row.status,
    priceCents: row.priceCents,
    notes: row.notes,
    reminderSentAt: row.reminderSentAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    client: {
      id: row.clientId,
      name: row.clientName,
      phone: row.clientPhone,
      phoneFormatted: formatPhone(row.clientPhone),
    },
    service: {
      id: row.serviceId,
      name: row.serviceName,
      durationMin: row.serviceDuration,
      color: row.serviceColor,
      category: row.serviceCategory,
    },
    professional: {
      id: row.professionalId,
      name: row.professionalName,
      color: row.professionalColor,
    },
  };
}

// ── Procedimentos ─────────────────────────────────────────────────────────────

export async function listServices(includeInactive = false): Promise<ServiceDto[]> {
  const rows = await repository.listServices(includeInactive);
  return rows.map(toServiceDto);
}

export async function createService(
  input: z.output<typeof createServiceSchema>,
): Promise<ServiceDto> {
  const row = await repository.insertService(input);
  return toServiceDto(row);
}

export async function updateService(
  id: string,
  input: z.output<typeof updateServiceSchema>,
): Promise<ServiceDto> {
  // Desativar um procedimento com agendamento futuro deixaria a agenda
  // apontando para algo que "não existe mais" — melhor avisar antes.
  if (input.active === false && (await repository.hasFutureAppointmentsForService(id))) {
    throw new ConflictError(
      "Este procedimento tem agendamentos futuros. Remarque-os antes de desativá-lo.",
    );
  }

  const row = await repository.updateServiceRow(id, input);
  if (!row) throw new NotFoundError("Procedimento");
  return toServiceDto(row);
}

// ── Profissionais ─────────────────────────────────────────────────────────────

export async function listProfessionals(includeInactive = false): Promise<ProfessionalDto[]> {
  const rows = await repository.listProfessionals(includeInactive);
  return rows.map(toProfessionalDto);
}

export async function createProfessional(
  input: z.output<typeof createProfessionalSchema>,
): Promise<ProfessionalDto> {
  const row = await repository.insertProfessional(input);
  return toProfessionalDto(row);
}

export async function updateProfessional(
  id: string,
  input: z.output<typeof updateProfessionalSchema>,
): Promise<ProfessionalDto> {
  const row = await repository.updateProfessionalRow(id, input);
  if (!row) throw new NotFoundError("Profissional");
  return toProfessionalDto(row);
}

// ── Agendamentos ──────────────────────────────────────────────────────────────

export async function listAgenda(range: AgendaRange): Promise<AppointmentDto[]> {
  if (range.to <= range.from) {
    throw new BadRequestError("O fim do período precisa ser depois do início.");
  }
  // Trava de sanidade: uma janela absurda derrubaria a resposta.
  const MAX_DAYS = 120;
  const days = (range.to.getTime() - range.from.getTime()) / 86_400_000;
  if (days > MAX_DAYS) {
    throw new BadRequestError(`Consulte no máximo ${MAX_DAYS} dias por vez.`);
  }

  const rows = await repository.listAppointmentsInRange({
    from: range.from,
    to: range.to,
    professionalId: range.professionalId,
    includeCanceled: range.includeCanceled,
  });
  return rows.map(toAppointmentDto);
}

export async function getAppointment(id: string): Promise<AppointmentDto> {
  const row = await repository.findAppointmentById(id);
  if (!row) throw new NotFoundError("Agendamento");
  return toAppointmentDto(row);
}

export async function listClientHistory(clientId: string): Promise<AppointmentDto[]> {
  const rows = await repository.listAppointmentsByClient(clientId);
  return rows.map(toAppointmentDto);
}

/**
 * Recusa o horário se a profissional já estiver ocupada, dizendo com quem e
 * quando — sem isso a recepção teria de sair procurando o conflito na grade.
 */
async function assertNoConflict(params: {
  professionalId: string;
  startAt: Date;
  endAt: Date;
  excludeId?: string;
}): Promise<void> {
  const clashes = await repository.findOverlappingAppointments(params);
  const clash = clashes[0];
  if (!clash) return;

  throw new ConflictError(
    `${clash.professionalName} já tem ${clash.clientName} das ${formatTime(clash.startAt)} às ${formatTime(clash.endAt)}.`,
    { startAt: ["Horário ocupado para esta profissional."] },
  );
}

export async function createAppointment(
  input: z.output<typeof createAppointmentSchema>,
  user: SessionUser,
): Promise<AppointmentDto> {
  const service = await repository.findServiceById(input.serviceId);
  if (!service) throw new NotFoundError("Procedimento");

  const professional = await repository.findProfessionalById(input.professionalId);
  if (!professional) throw new NotFoundError("Profissional");

  // O fim vem da duração cadastrada, salvo quando quem agenda informa outro.
  const endAt = input.endAt ?? addMinutes(input.startAt, service.durationMin);
  if (endAt <= input.startAt) {
    throw new BadRequestError("O término precisa ser depois do início.");
  }

  await assertNoConflict({
    professionalId: input.professionalId,
    startAt: input.startAt,
    endAt,
  });

  const row = await repository.insertAppointment({
    clientId: input.clientId,
    serviceId: input.serviceId,
    professionalId: input.professionalId,
    startAt: input.startAt,
    endAt,
    status: input.status,
    // Preço congelado no ato: mudar a tabela depois não reescreve o passado.
    priceCents: input.priceCents ?? service.priceCents,
    notes: input.notes,
    createdBy: user.id,
  });

  return getAppointment(row.id);
}

export async function updateAppointment(
  id: string,
  input: z.output<typeof updateAppointmentSchema>,
): Promise<AppointmentDto> {
  const existing = await repository.findAppointmentRow(id);
  if (!existing) throw new NotFoundError("Agendamento");

  const professionalId = input.professionalId ?? existing.professionalId;
  const startAt = input.startAt ?? existing.startAt;

  // Trocar o procedimento sem informar novo fim recalcula a duração.
  let endAt = input.endAt ?? existing.endAt;
  if (input.serviceId && input.serviceId !== existing.serviceId && !input.endAt) {
    const service = await repository.findServiceById(input.serviceId);
    if (!service) throw new NotFoundError("Procedimento");
    endAt = addMinutes(startAt, service.durationMin);
  } else if (input.startAt && !input.endAt) {
    // Só mudou o horário: preserva a duração original ao arrastar na grade.
    const durationMs = existing.endAt.getTime() - existing.startAt.getTime();
    endAt = new Date(startAt.getTime() + durationMs);
  }

  if (endAt <= startAt) {
    throw new BadRequestError("O término precisa ser depois do início.");
  }

  const movedOrRescheduled =
    input.startAt !== undefined ||
    input.endAt !== undefined ||
    input.professionalId !== undefined ||
    input.serviceId !== undefined;

  const willBlock =
    !input.status || (input.status !== "CANCELED" && input.status !== "NO_SHOW");

  if (movedOrRescheduled && willBlock) {
    await assertNoConflict({ professionalId, startAt, endAt, excludeId: id });
  }

  const isCanceling = input.status === "CANCELED" && existing.status !== "CANCELED";

  const row = await repository.updateAppointmentRow(id, {
    ...(input.clientId !== undefined && { clientId: input.clientId }),
    ...(input.serviceId !== undefined && { serviceId: input.serviceId }),
    ...(input.professionalId !== undefined && { professionalId: input.professionalId }),
    ...(input.startAt !== undefined && { startAt }),
    endAt,
    ...(input.priceCents !== undefined && { priceCents: input.priceCents }),
    ...(input.status !== null && input.status !== undefined && { status: input.status }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(isCanceling && { canceledAt: new Date(), cancelReason: input.cancelReason ?? null }),
  });

  if (!row) throw new NotFoundError("Agendamento");
  return getAppointment(row.id);
}

export async function deleteAppointment(id: string): Promise<void> {
  const removed = await repository.deleteAppointment(id);
  if (!removed) throw new NotFoundError("Agendamento");
}

/** Marca que o lembrete de WhatsApp foi disparado. */
export async function markReminderSent(id: string): Promise<AppointmentDto> {
  const row = await repository.updateAppointmentRow(id, { reminderSentAt: new Date() });
  if (!row) throw new NotFoundError("Agendamento");
  return getAppointment(row.id);
}
