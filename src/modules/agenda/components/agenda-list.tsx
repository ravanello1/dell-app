"use client";

import { CalendarOff, Clock, User } from "lucide-react";
import { cn } from "@/core/utils/cn";
import { formatCents } from "@/core/utils/money";
import { formatDayLong, formatTime, studioStartOfDay } from "@/core/utils/date";
import { Badge } from "@/ui/badge";
import { EmptyState } from "@/ui/feedback";
import { statusStyles } from "../agenda.presentation";
import type { AppointmentDto } from "../agenda.dto";

/**
 * Agenda em lista, agrupada por dia.
 *
 * É o que aparece no celular na visão de semana: uma grade de 7 colunas num
 * aparelho de 375px daria colunas de 46px, ilegíveis. A lista mostra a mesma
 * informação numa forma que cabe na mão.
 */
export function AgendaList({
  appointments,
  onSelect,
  emptyMessage = "Nenhum atendimento neste período.",
}: {
  appointments: AppointmentDto[];
  onSelect: (appointment: AppointmentDto) => void;
  emptyMessage?: string;
}) {
  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={<CalendarOff className="size-6" aria-hidden />}
        title="Agenda livre"
        description={emptyMessage}
      />
    );
  }

  // Agrupa por dia preservando a ordem cronológica.
  const byDay = new Map<number, AppointmentDto[]>();
  for (const appointment of appointments) {
    const key = studioStartOfDay(new Date(appointment.startAt)).getTime();
    const bucket = byDay.get(key);
    if (bucket) bucket.push(appointment);
    else byDay.set(key, [appointment]);
  }

  const todayKey = studioStartOfDay(new Date()).getTime();

  return (
    <div className="flex flex-col gap-4">
      {[...byDay.entries()]
        .sort(([a], [b]) => a - b)
        .map(([dayKey, dayAppointments]) => (
          <section key={dayKey}>
            <h3
              className={cn(
                "mb-1.5 flex items-center gap-2 px-1 text-sm font-semibold first-letter:uppercase",
                dayKey === todayKey ? "text-rose-700" : "text-ink-700",
              )}
            >
              {formatDayLong(new Date(dayKey))}
              {dayKey === todayKey && <Badge tone="rose">Hoje</Badge>}
            </h3>

            <ul className="divide-y divide-line overflow-hidden rounded-(--radius-card) border border-line bg-surface">
              {dayAppointments.map((appointment) => {
                const style = statusStyles[appointment.status];
                return (
                  <li key={appointment.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(appointment)}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-gold-50"
                    >
                      <span
                        aria-hidden
                        className="h-11 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: appointment.service.color }}
                      />

                      <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-ink-900">
                        {formatTime(new Date(appointment.startAt))}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink-900">
                          {appointment.client.name}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-600">
                          <span className="truncate">
                            {appointment.services && appointment.services.length > 0
                              ? appointment.services.map((s) => s.name).join(" + ")
                              : appointment.service.name}
                          </span>
                          <span className="flex items-center gap-1 text-ink-400">
                            <User className="size-3" aria-hidden />
                            {appointment.professional.name}
                          </span>
                          <span className="flex items-center gap-1 text-ink-400">
                            <Clock className="size-3" aria-hidden />
                            {formatTime(new Date(appointment.startAt))}–
                            {formatTime(new Date(appointment.endAt))}
                          </span>
                        </span>
                      </span>

                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <Badge tone={style.tone}>{style.label}</Badge>
                        {appointment.priceCents > 0 && (
                          <span className="text-xs tabular-nums text-ink-600">
                            {formatCents(appointment.priceCents)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}
