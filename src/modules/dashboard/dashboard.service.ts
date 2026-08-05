import type { SessionUser } from "@/core/auth/session";
import { formatInStudio, studioEndOfDay, studioStartOfDay } from "@/core/utils/date";
import { listAgenda } from "@/modules/agenda/agenda.service";
import { listBirthdaysInMonth, countActiveClients } from "@/modules/clients/client.repository";
import { listLowStock } from "@/modules/inventory/inventory.service";
import type { AppointmentDto } from "@/modules/agenda/agenda.dto";
import type { ProductDto } from "@/modules/inventory/inventory.dto";

/**
 * O painel "Hoje".
 *
 * É o único ponto do sistema que costura os três módulos — e faz isso pela
 * porta da frente: chama o `service` público de cada um, nunca o repositório ou
 * as tabelas. É por isso que agenda, clientes e estoque continuam sem se
 * conhecer, mesmo aparecendo lado a lado nesta tela.
 */

export interface DashboardBirthday {
  id: string;
  name: string;
  phone: string;
  day: number;
  isToday: boolean;
}

export interface DashboardData {
  appointmentsToday: AppointmentDto[];
  expectedRevenueCents: number;
  activeClients: number;
  lowStock: ProductDto[];
  birthdays: DashboardBirthday[];
}

export async function getDashboard(user: SessionUser): Promise<DashboardData> {
  const now = new Date();
  const currentMonth = formatInStudio(now, "MM");
  const todayDay = Number(formatInStudio(now, "dd"));

  const [appointmentsToday, activeClients, lowStock, birthdayRows] = await Promise.all([
    listAgenda({
      from: studioStartOfDay(now),
      to: studioEndOfDay(now),
      includeCanceled: false,
    }),
    countActiveClients(),
    listLowStock(user),
    listBirthdaysInMonth(currentMonth),
  ]);

  // Faturamento previsto conta só o que ainda pode acontecer — quem faltou não
  // entra, senão o número do dia mente para cima.
  const expectedRevenueCents = appointmentsToday
    .filter((appointment) => appointment.status !== "NO_SHOW")
    .reduce((sum, appointment) => sum + appointment.priceCents, 0);

  const birthdays: DashboardBirthday[] = birthdayRows.map((row) => {
    const day = Number(row.birthDate?.slice(8, 10) ?? 0);
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      day,
      isToday: day === todayDay,
    };
  });

  return { appointmentsToday, expectedRevenueCents, activeClients, lowStock, birthdays };
}
