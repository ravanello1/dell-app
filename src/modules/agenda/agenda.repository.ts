import { and, asc, between, eq, gte, inArray, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { clients } from "@/modules/clients/client.schema";
import {
  appointmentServices,
  appointments,
  blockingStatuses,
  type AppointmentRow,
  type AppointmentStatus,
  type NewAppointmentRow,
} from "./appointment.schema";
import { professionals, type NewProfessionalRow, type ProfessionalRow } from "./professional.schema";
import { services, type NewServiceRow, type ServiceCategory, type ServiceRow } from "./service.schema";

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

export interface AppointmentServiceItemRow {
  appointmentId: string;
  serviceId: string;
  serviceName: string;
  serviceDuration: number;
  servicePriceCents: number;
  serviceColor: string;
  serviceCategory: ServiceCategory;
  sortOrder: number;
}

export interface AppointmentJoinedRow {
  id: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  priceCents: number;
  notes: string | null;
  reminderSentAt: Date | null;
  cancelReason: string | null;
  clientId: string;
  clientName: string;
  clientPhone: string;
  professionalId: string;
  professionalName: string;
  professionalColor: string;
  services: Array<{
    id: string;
    name: string;
    durationMin: number;
    priceCents: number;
    color: string;
    category: ServiceCategory;
  }>;
}

const appointmentBaseSelection = {
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
  professionalId: professionals.id,
  professionalName: professionals.name,
  professionalColor: professionals.color,
  fallbackServiceId: appointments.serviceId,
  fallbackServiceName: services.name,
  fallbackServiceDuration: services.durationMin,
  fallbackServicePriceCents: services.priceCents,
  fallbackServiceColor: services.color,
  fallbackServiceCategory: services.category,
} as const;

function baseQuery() {
  return db
    .select(appointmentBaseSelection)
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.id))
    .innerJoin(professionals, eq(appointments.professionalId, professionals.id))
    .leftJoin(services, eq(appointments.serviceId, services.id));
}

type AppointmentBaseRow = Awaited<ReturnType<typeof baseQuery>>[number];

export async function findServicesForAppointments(
  appointmentIds: string[],
): Promise<Map<string, AppointmentServiceItemRow[]>> {
  if (appointmentIds.length === 0) return new Map();

  const rows = await db
    .select({
      appointmentId: appointmentServices.appointmentId,
      serviceId: services.id,
      serviceName: services.name,
      serviceDuration: appointmentServices.durationMin,
      servicePriceCents: appointmentServices.priceCents,
      serviceColor: services.color,
      serviceCategory: services.category,
      sortOrder: appointmentServices.sortOrder,
    })
    .from(appointmentServices)
    .innerJoin(services, eq(appointmentServices.serviceId, services.id))
    .where(inArray(appointmentServices.appointmentId, appointmentIds))
    .orderBy(asc(appointmentServices.sortOrder), asc(appointmentServices.createdAt));

  const map = new Map<string, AppointmentServiceItemRow[]>();
  for (const row of rows) {
    const list = map.get(row.appointmentId) ?? [];
    list.push(row);
    map.set(row.appointmentId, list);
  }
  return map;
}

async function attachServices(rows: AppointmentBaseRow[]): Promise<AppointmentJoinedRow[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const servicesMap = await findServicesForAppointments(ids);

  return rows.map((row) => {
    const attachedServices = servicesMap.get(row.id);
    const servicesList =
      attachedServices && attachedServices.length > 0
        ? attachedServices.map((s) => ({
            id: s.serviceId,
            name: s.serviceName,
            durationMin: s.serviceDuration,
            priceCents: s.servicePriceCents,
            color: s.serviceColor,
            category: s.serviceCategory,
          }))
        : row.fallbackServiceId
          ? [
              {
                id: row.fallbackServiceId,
                name: row.fallbackServiceName ?? "Procedimento",
                durationMin: row.fallbackServiceDuration ?? 60,
                priceCents: row.fallbackServicePriceCents ?? 0,
                color: row.fallbackServiceColor ?? "#be3f6c",
                category: row.fallbackServiceCategory ?? "CILIOS",
              },
            ]
          : [];

    return {
      id: row.id,
      startAt: row.startAt,
      endAt: row.endAt,
      status: row.status,
      priceCents: row.priceCents,
      notes: row.notes,
      reminderSentAt: row.reminderSentAt,
      cancelReason: row.cancelReason,
      clientId: row.clientId,
      clientName: row.clientName,
      clientPhone: row.clientPhone,
      professionalId: row.professionalId,
      professionalName: row.professionalName,
      professionalColor: row.professionalColor,
      services: servicesList,
    };
  });
}

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

  const rows = await baseQuery()
    .where(and(...filters))
    .orderBy(asc(appointments.startAt));

  return attachServices(rows);
}

export async function findAppointmentById(id: string): Promise<AppointmentJoinedRow | undefined> {
  const rows = await baseQuery().where(eq(appointments.id, id)).limit(1);
  const [row] = await attachServices(rows);
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
  const rows = await baseQuery()
    .where(eq(appointments.clientId, clientId))
    .orderBy(sql`${appointments.startAt} desc`)
    .limit(limit);

  return attachServices(rows);
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

  const rows = await baseQuery().where(and(...filters));
  return attachServices(rows);
}

export interface ServiceItemInsert {
  serviceId: string;
  durationMin: number;
  priceCents: number;
  sortOrder?: number;
}

export async function insertAppointment(
  values: NewAppointmentRow,
  serviceItems: ServiceItemInsert[] = [],
): Promise<AppointmentRow> {
  const [row] = await db.insert(appointments).values(values).returning();
  if (!row) throw new Error("Falha ao inserir agendamento.");

  if (serviceItems.length > 0) {
    await db.insert(appointmentServices).values(
      serviceItems.map((item, index) => ({
        appointmentId: row.id,
        serviceId: item.serviceId,
        durationMin: item.durationMin,
        priceCents: item.priceCents,
        sortOrder: item.sortOrder ?? index,
      })),
    );
  }

  return row;
}

export async function updateAppointmentRow(
  id: string,
  values: Partial<NewAppointmentRow>,
  serviceItems?: ServiceItemInsert[],
): Promise<AppointmentRow | undefined> {
  const [row] = await db.update(appointments).set(values).where(eq(appointments.id, id)).returning();
  if (!row) return undefined;

  if (serviceItems !== undefined) {
    await db.delete(appointmentServices).where(eq(appointmentServices.appointmentId, id));
    if (serviceItems.length > 0) {
      await db.insert(appointmentServices).values(
        serviceItems.map((item, index) => ({
          appointmentId: id,
          serviceId: item.serviceId,
          durationMin: item.durationMin,
          priceCents: item.priceCents,
          sortOrder: item.sortOrder ?? index,
        })),
      );
    }
  }

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
  const [rowAppointment] = await db
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

  if (rowAppointment) return true;

  const [rowService] = await db
    .select({ id: appointmentServices.id })
    .from(appointmentServices)
    .innerJoin(appointments, eq(appointmentServices.appointmentId, appointments.id))
    .where(
      and(
        eq(appointmentServices.serviceId, serviceId),
        gte(appointments.startAt, new Date()),
        or(eq(appointments.status, "SCHEDULED"), eq(appointments.status, "CONFIRMED")),
      ),
    )
    .limit(1);

  return Boolean(rowService);
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
