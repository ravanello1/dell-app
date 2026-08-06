import { and, asc, between, eq, gte, inArray, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { clients } from "@/modules/clients/client.schema";
import {
  appointments,
  blockingStatuses,
  type AppointmentRow,
  type NewAppointmentRow,
} from "./appointment.schema";
import { professionals, type NewProfessionalRow, type ProfessionalRow } from "./professional.schema";
import { services, type NewServiceRow, type ServiceRow } from "./service.schema";

/** Único ponto do módulo de agenda com acesso ao banco. */

// ── Procedimentos ─────────────────────────────────────────────────────────────

export async function listServices(includeInactive = false): Promise<ServiceRow[]> {
  const where = includeInactive ? undefined : eq(services.active, true);
  return db
    .select()
    .from(services)
    .where(where)
    .orderBy(asc(services.sortOrder), asc(services.name));
}

export async function findServiceById(id: string): Promise<ServiceRow | undefined> {
  const [row] = await db.select().from(services).where(eq(services.id, id)).limit(1);
  return row;
}

export async function insertService(values: NewServiceRow): Promise<ServiceRow> {
  const [row] = await db.insert(services).values(values).returning();
  if (!row) throw new Error("Falha ao inserir procedimento.");
  return row;
}

export async function updateServiceRow(
  id: string,
  values: Partial<NewServiceRow>,
): Promise<ServiceRow | undefined> {
  const [row] = await db.update(services).set(values).where(eq(services.id, id)).returning();
  return row;
}

// ── Profissionais ─────────────────────────────────────────────────────────────

export async function listProfessionals(includeInactive = false): Promise<ProfessionalRow[]> {
  const where = includeInactive ? undefined : eq(professionals.active, true);
  return db
    .select()
    .from(professionals)
    .where(where)
    .orderBy(asc(professionals.sortOrder), asc(professionals.name));
}

export async function findProfessionalById(id: string): Promise<ProfessionalRow | undefined> {
  const [row] = await db.select().from(professionals).where(eq(professionals.id, id)).limit(1);
  return row;
}

export async function insertProfessional(values: NewProfessionalRow): Promise<ProfessionalRow> {
  const [row] = await db.insert(professionals).values(values).returning();
  if (!row) throw new Error("Falha ao inserir profissional.");
  return row;
}

export async function updateProfessionalRow(
  id: string,
  values: Partial<NewProfessionalRow>,
): Promise<ProfessionalRow | undefined> {
  const [row] = await db
    .update(professionals)
    .set(values)
    .where(eq(professionals.id, id))
    .returning();
  return row;
}

// ── Agendamentos ──────────────────────────────────────────────────────────────

/** Colunas devolvidas na consulta com junções — a forma que o calendário usa. */
const appointmentSelection = {
  id: appointments.id,
  startAt: appointments.startAt,
  endAt: appointments.endAt,
  status: appointments.status,
  priceCents: appointments.priceCents,
  notes: appointments.notes,
  reminderSentAt: appointments.reminderSentAt,
  cancelReason: appointments.cancelReason,
  clientId: clients.id,
  clientName: clients.name,
  clientPhone: clients.phone,
  serviceId: services.id,
  serviceName: services.name,
  serviceDuration: services.durationMin,
  serviceColor: services.color,
  serviceCategory: services.category,
  professionalId: professionals.id,
  professionalName: professionals.name,
  professionalColor: professionals.color,
} as const;

function joinedQuery() {
  return db
    .select(appointmentSelection)
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.id))
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .innerJoin(professionals, eq(appointments.professionalId, professionals.id));
}

/**
 * Formato de uma linha com as junções aplicadas.
 *
 * Derivado da própria consulta, e não escrito à mão: assim a nulidade de cada
 * coluna vem do schema, e acrescentar um campo à seleção atualiza o tipo
 * sozinho.
 */
export type AppointmentJoinedRow = Awaited<ReturnType<typeof joinedQuery>>[number];

/**
 * Agendamentos que começam dentro da janela consultada.
 *
 * O filtro é por `startAt` (e não por interseção completa) porque a agenda
 * sempre carrega um dia, semana ou mês inteiro: um atendimento que atravesse a
 * meia-noite aparece no dia em que começou, que é como se lê uma agenda.
 */
export async function listAppointmentsInRange(params: {
  from: Date;
  to: Date;
  professionalId?: string;
  includeCanceled: boolean;
}): Promise<AppointmentJoinedRow[]> {
  const filters = [gte(appointments.startAt, params.from), lt(appointments.startAt, params.to)];

  if (params.professionalId) {
    filters.push(eq(appointments.professionalId, params.professionalId));
  }
  if (!params.includeCanceled) {
    filters.push(ne(appointments.status, "CANCELED"));
  }

  return joinedQuery()
    .where(and(...filters))
    .orderBy(asc(appointments.startAt));
}

export async function findAppointmentById(id: string): Promise<AppointmentJoinedRow | undefined> {
  const [row] = await joinedQuery().where(eq(appointments.id, id)).limit(1);
  return row;
}

export async function findAppointmentRow(id: string): Promise<AppointmentRow | undefined> {
  const [row] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  return row;
}

/** Histórico de uma cliente, do mais recente para o mais antigo. */
export async function listAppointmentsByClient(
  clientId: string,
  limit = 50,
): Promise<AppointmentJoinedRow[]> {
  return joinedQuery()
    .where(eq(appointments.clientId, clientId))
    .orderBy(sql`${appointments.startAt} desc`)
    .limit(limit);
}

/**
 * Atendimentos da mesma profissional que colidem com a janela informada.
 *
 * Dois intervalos [a,b) e [c,d) se sobrepõem quando a < d e c < b. Cancelados e
 * faltas não bloqueiam — o horário volta a ficar livre.
 */
export async function findOverlappingAppointments(params: {
  professionalId: string;
  startAt: Date;
  endAt: Date;
  excludeId?: string;
}): Promise<AppointmentJoinedRow[]> {
  const filters = [
    eq(appointments.professionalId, params.professionalId),
    inArray(appointments.status, [...blockingStatuses]),
    lt(appointments.startAt, params.endAt),
    sql`${appointments.endAt} > ${params.startAt.getTime()}`,
  ];

  if (params.excludeId) {
    filters.push(ne(appointments.id, params.excludeId));
  }

  return joinedQuery().where(and(...filters));
}

export async function insertAppointment(values: NewAppointmentRow): Promise<AppointmentRow> {
  const [row] = await db.insert(appointments).values(values).returning();
  if (!row) throw new Error("Falha ao inserir agendamento.");
  return row;
}

export async function updateAppointmentRow(
  id: string,
  values: Partial<NewAppointmentRow>,
): Promise<AppointmentRow | undefined> {
  const [row] = await db.update(appointments).set(values).where(eq(appointments.id, id)).returning();
  return row;
}

export async function deleteAppointment(id: string): Promise<boolean> {
  const [row] = await db.delete(appointments).where(eq(appointments.id, id)).returning({
    id: appointments.id,
  });
  return Boolean(row);
}

/** Quantos atendimentos existem em cada dia da janela — usado na visão de mês. */
export async function countAppointmentsByDay(params: {
  from: Date;
  to: Date;
  professionalId?: string;
}): Promise<AppointmentRow[]> {
  const filters = [
    between(appointments.startAt, params.from, params.to),
    ne(appointments.status, "CANCELED"),
  ];
  if (params.professionalId) filters.push(eq(appointments.professionalId, params.professionalId));

  return db
    .select()
    .from(appointments)
    .where(and(...filters))
    .orderBy(asc(appointments.startAt));
}

/** Usado ao desativar um procedimento: existe agendamento futuro com ele? */
export async function hasFutureAppointmentsForService(serviceId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.serviceId, serviceId),
        gte(appointments.startAt, new Date()),
        or(eq(appointments.status, "SCHEDULED"), eq(appointments.status, "CONFIRMED")),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Data da última visita de cada cliente — o atendimento passado mais recente
 * que de fato aconteceu (nem cancelado, nem falta). Base do grupo "sumidas" do
 * marketing.
 */
export async function lastVisitByClient(): Promise<Map<string, Date>> {
  const rows = await db
    .select({
      clientId: appointments.clientId,
      lastVisit: sql<number>`max(${appointments.startAt})`,
    })
    .from(appointments)
    .where(
      and(
        lt(appointments.startAt, new Date()),
        ne(appointments.status, "CANCELED"),
        ne(appointments.status, "NO_SHOW"),
      ),
    )
    .groupBy(appointments.clientId);

  const map = new Map<string, Date>();
  for (const row of rows) {
    if (row.lastVisit != null) map.set(row.clientId, new Date(Number(row.lastVisit)));
  }
  return map;
}
