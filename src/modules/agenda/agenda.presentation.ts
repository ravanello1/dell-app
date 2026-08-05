import type { BadgeTone } from "@/ui/badge";
import { appointmentStatusLabels, type AppointmentStatus } from "./appointment.schema";
import type { AppointmentDto } from "./agenda.dto";

/**
 * Como cada estado de um atendimento se apresenta na tela.
 *
 * O status é a informação que mais se lê de relance numa agenda cheia, então
 * cada um tem cor e peso visual próprios: confirmado é verde e sólido, agendado
 * é neutro à espera de confirmação, cancelado desaparece de propósito.
 */

export interface StatusStyle {
  label: string;
  tone: BadgeTone;
  /** Classe do card na grade do calendário. */
  card: string;
  /** Ordem em que os status aparecem no seletor. */
  order: number;
}

export const statusStyles: Record<AppointmentStatus, StatusStyle> = {
  SCHEDULED: {
    label: appointmentStatusLabels.SCHEDULED,
    tone: "gold",
    card: "bg-gold-50 border-gold-300 text-gold-900",
    order: 0,
  },
  CONFIRMED: {
    label: appointmentStatusLabels.CONFIRMED,
    tone: "success",
    card: "bg-success-soft border-success/35 text-ink-900",
    order: 1,
  },
  IN_PROGRESS: {
    label: appointmentStatusLabels.IN_PROGRESS,
    tone: "info",
    card: "bg-info-soft border-info/40 text-ink-900",
    order: 2,
  },
  DONE: {
    label: appointmentStatusLabels.DONE,
    tone: "neutral",
    card: "bg-surface-sunken border-line-strong text-ink-700",
    order: 3,
  },
  NO_SHOW: {
    label: appointmentStatusLabels.NO_SHOW,
    tone: "warning",
    card: "bg-warning-soft border-warning/35 text-ink-700",
    order: 4,
  },
  CANCELED: {
    label: appointmentStatusLabels.CANCELED,
    tone: "danger",
    card: "bg-surface border-line text-ink-400 line-through opacity-70",
    order: 5,
  },
};

/** Status que a pessoa escolhe manualmente, na ordem em que fazem sentido. */
export const selectableStatuses = (Object.keys(statusStyles) as AppointmentStatus[]).sort(
  (a, b) => statusStyles[a].order - statusStyles[b].order,
);

/** Um atendimento cancelado ou com falta libera o horário na grade. */
export function occupiesSlot(appointment: AppointmentDto): boolean {
  return appointment.status !== "CANCELED" && appointment.status !== "NO_SHOW";
}

/**
 * Distribui atendimentos que se sobrepõem em colunas lado a lado.
 *
 * A regra de conflito impede sobreposição entre atendimentos ativos da mesma
 * profissional, mas cancelados e faltas continuam desenhados na grade e podem
 * cair em cima de um horário reocupado. Sem este cálculo, um card ficaria
 * escondido embaixo do outro.
 *
 * Devolve, para cada atendimento, em qual coluna ele entra e quantas colunas o
 * grupo sobreposto tem no total.
 */
export function layoutOverlaps<T extends { startAt: string; endAt: string }>(
  items: T[],
): Array<{ item: T; column: number; columns: number }> {
  const sorted = [...items].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );

  const result: Array<{ item: T; column: number; columns: number }> = [];
  let group: Array<{ item: T; column: number }> = [];
  let groupEndsAt = 0;

  const flush = () => {
    if (group.length === 0) return;
    const columns = Math.max(...group.map((entry) => entry.column)) + 1;
    for (const entry of group) result.push({ ...entry, columns });
    group = [];
    groupEndsAt = 0;
  };

  for (const item of sorted) {
    const start = new Date(item.startAt).getTime();
    const end = new Date(item.endAt).getTime();

    // Começou depois do fim de todo o grupo anterior: abre um grupo novo.
    if (start >= groupEndsAt) flush();

    // Primeira coluna livre neste instante.
    const taken = new Set(
      group
        .filter((entry) => new Date(entry.item.endAt).getTime() > start)
        .map((entry) => entry.column),
    );
    let column = 0;
    while (taken.has(column)) column += 1;

    group.push({ item, column });
    groupEndsAt = Math.max(groupEndsAt, end);
  }

  flush();
  return result;
}
