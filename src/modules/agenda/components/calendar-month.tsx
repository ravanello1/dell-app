"use client";

import { addDays, startOfDay } from "date-fns";
import { cn } from "@/core/utils/cn";
import { formatInStudio, studioStartOfDay, toStudioTime } from "@/core/utils/date";
import { statusStyles } from "../agenda.presentation";
import type { AppointmentDto } from "../agenda.dto";

/**
 * Visão de mês — panorama, não detalhe.
 *
 * Cada dia mostra até três atendimentos e um contador do resto. A intenção
 * aqui é responder "que dias estão cheios?" de relance; para trabalhar num dia
 * específico, o clique leva para a visão de dia.
 */

const WEEKDAY_LABELS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const MAX_VISIBLE = 3;

export function CalendarMonth({
  monthStart,
  appointments,
  onSelectDay,
  onSelectAppointment,
}: {
  /** Primeiro dia da grade (segunda-feira da primeira semana exibida). */
  monthStart: Date;
  /** Mês de referência — dias fora dele aparecem esmaecidos. */
  appointments: AppointmentDto[];
  onSelectDay: (day: Date) => void;
  onSelectAppointment: (appointment: AppointmentDto) => void;
}) {
  const referenceMonth = toStudioTime(addDays(monthStart, 10)).getMonth();
  const todayKey = studioStartOfDay(new Date()).getTime();

  // Agrupa uma vez só: dentro do laço de 42 células seria O(42 × n).
  const byDay = new Map<number, AppointmentDto[]>();
  for (const appointment of appointments) {
    const key = studioStartOfDay(new Date(appointment.startAt)).getTime();
    const bucket = byDay.get(key);
    if (bucket) bucket.push(appointment);
    else byDay.set(key, [appointment]);
  }

  const days = Array.from({ length: 42 }, (_, index) => addDays(monthStart, index));

  return (
    <div className="overflow-hidden rounded-(--radius-card) border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-400"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayKey = studioStartOfDay(day).getTime();
          const dayAppointments = byDay.get(dayKey) ?? [];
          const zoned = toStudioTime(day);
          const isCurrentMonth = zoned.getMonth() === referenceMonth;
          const isToday = dayKey === todayKey;

          return (
            <div
              key={dayKey}
              className={cn(
                "min-h-20 border-b border-r border-line p-1 last-of-type:border-r-0 sm:min-h-28",
                !isCurrentMonth && "bg-surface-muted/60",
              )}
            >
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                className={cn(
                  "mb-1 flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors",
                  isToday
                    ? "bg-rose-600 text-white"
                    : isCurrentMonth
                      ? "text-ink-700 hover:bg-gold-100"
                      : "text-ink-400 hover:bg-gold-50",
                )}
                aria-label={`Abrir ${formatInStudio(day, "d 'de' MMMM")}`}
              >
                {formatInStudio(day, "d")}
              </button>

              <div className="flex flex-col gap-0.5">
                {dayAppointments.slice(0, MAX_VISIBLE).map((appointment) => (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => onSelectAppointment(appointment)}
                    className={cn(
                      "flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight sm:text-[11px]",
                      statusStyles[appointment.status].card,
                    )}
                    title={`${formatInStudio(new Date(appointment.startAt), "HH:mm")} ${appointment.client.name} — ${appointment.service.name}`}
                  >
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: appointment.service.color }}
                    />
                    <span className="hidden shrink-0 tabular-nums sm:inline">
                      {formatInStudio(new Date(appointment.startAt), "HH:mm")}
                    </span>
                    <span className="truncate">{appointment.client.name}</span>
                  </button>
                ))}

                {dayAppointments.length > MAX_VISIBLE && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(day)}
                    className="px-1 text-left text-[10px] font-medium text-gold-700 hover:underline"
                  >
                    +{dayAppointments.length - MAX_VISIBLE} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { startOfDay };
