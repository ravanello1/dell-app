"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/core/utils/cn";
import { formatTime, minutesFromStudioMidnight, toStudioTime } from "@/core/utils/date";
import { layoutOverlaps, statusStyles } from "../agenda.presentation";
import type { AppointmentDto } from "../agenda.dto";

/**
 * Grade de horários — a peça compartilhada pelas visões de dia e de semana.
 *
 * Feita à mão em vez de com uma biblioteca de calendário por dois motivos
 * práticos: controle total da paleta do studio, e porque as bibliotecas
 * populares foram desenhadas para mouse — arrastar, redimensionar, tooltip no
 * hover — e ficam desconfortáveis no celular, que é onde este app mais vai ser
 * usado, no meio de um atendimento.
 */

/** Altura de uma hora, em pixels. Define a escala inteira da grade. */
const HOUR_HEIGHT = 64;
const MINUTE_HEIGHT = HOUR_HEIGHT / 60;

export interface CalendarColumn {
  key: string;
  label: string;
  /** Cor da faixa no topo da coluna (profissional ou dia). */
  color?: string;
  /** Sublabel: dia do mês, na visão de semana. */
  sublabel?: string;
  highlighted?: boolean;
  appointments: AppointmentDto[];
  /** Instante de 00:00 do dia desta coluna, no fuso do studio. */
  dayStart: Date;
}

interface CalendarGridProps {
  columns: CalendarColumn[];
  /** Primeira e última hora exibidas. */
  startHour: number;
  endHour: number;
  onSelectAppointment: (appointment: AppointmentDto) => void;
  /** Clique num espaço livre: cria já com o horário preenchido. */
  onSelectSlot: (start: Date, columnKey: string) => void;
  /** Mostra a linha do "agora" quando alguma coluna é hoje. */
  showNowLine?: boolean;
}

function AppointmentCard({
  appointment,
  column,
  columns,
  startHour,
  dayStart,
  onSelect,
}: {
  appointment: AppointmentDto;
  column: number;
  columns: number;
  startHour: number;
  dayStart: Date;
  onSelect: () => void;
}) {
  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);

  const startMinutes = (start.getTime() - dayStart.getTime()) / 60_000;
  const endMinutes = (end.getTime() - dayStart.getTime()) / 60_000;

  const top = (startMinutes - startHour * 60) * MINUTE_HEIGHT;
  const height = Math.max(22, (endMinutes - startMinutes) * MINUTE_HEIGHT);

  const style = statusStyles[appointment.status];
  const widthPercent = 100 / columns;

  // Abaixo de ~40px não cabe uma segunda linha de texto sem virar poluição.
  const isCompact = height < 42;

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        top,
        height,
        left: `calc(${column * widthPercent}% + 2px)`,
        width: `calc(${widthPercent}% - 4px)`,
        borderLeftColor: appointment.service.color,
      }}
      className={cn(
        "absolute overflow-hidden rounded-md border border-l-4 px-2 py-1 text-left",
        "transition-shadow hover:z-10 hover:shadow-(--shadow-card)",
        "focus-visible:z-10",
        style.card,
      )}
      title={`${formatTime(start)}–${formatTime(end)} · ${appointment.client.name} · ${appointment.service.name}`}
    >
      <span className="block truncate text-xs font-semibold leading-tight">
        {appointment.client.name}
      </span>
      {!isCompact && (
        <span className="mt-0.5 block truncate text-[11px] leading-tight opacity-80">
          {formatTime(start)} · {appointment.service.name}
        </span>
      )}
    </button>
  );
}

export function CalendarGrid({
  columns,
  startHour,
  endHour,
  onSelectAppointment,
  onSelectSlot,
  showNowLine = true,
}: CalendarGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, index) => startHour + index),
    [startHour, endHour],
  );

  // Ao abrir, rola até o primeiro atendimento do dia — e não até as 7h, que
  // costumam estar vazias. Quem abre a agenda quer ver onde a coisa começa.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const firstStart = columns
      .flatMap((column) => column.appointments)
      .map((appointment) => minutesFromStudioMidnight(new Date(appointment.startAt)))
      .sort((a, b) => a - b)[0];

    const targetMinutes = firstStart ?? 9 * 60;
    container.scrollTop = Math.max(0, (targetMinutes - startHour * 60 - 30) * MINUTE_HEIGHT);
  }, [columns, startHour]);

  const now = new Date();
  const nowMinutes = minutesFromStudioMidnight(now);
  const nowOffset = (nowMinutes - startHour * 60) * MINUTE_HEIGHT;
  const nowIsVisible =
    showNowLine && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60;

  return (
    <div className="overflow-hidden rounded-(--radius-card) border border-line bg-surface">
      {/* Cabeçalho das colunas — fica fixo enquanto a grade rola */}
      <div className="flex border-b border-line bg-surface">
        <div className="w-12 shrink-0 border-r border-line sm:w-14" aria-hidden />
        {columns.map((column) => (
          <div
            key={column.key}
            className={cn(
              "min-w-0 flex-1 border-r border-line px-2 py-2 text-center last:border-r-0",
              column.highlighted && "bg-rose-50",
            )}
          >
            <p
              className={cn(
                "truncate text-xs font-semibold",
                column.highlighted ? "text-rose-700" : "text-ink-700",
              )}
            >
              {column.label}
            </p>
            {column.sublabel && (
              <p className="text-[11px] text-ink-400">{column.sublabel}</p>
            )}
            {column.color && (
              <span
                aria-hidden
                className="mx-auto mt-1 block h-1 w-8 rounded-full"
                style={{ backgroundColor: column.color }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Corpo rolável */}
      <div ref={scrollRef} className="scrollbar-slim max-h-[65dvh] overflow-y-auto">
        <div className="flex" style={{ height: hours.length * HOUR_HEIGHT }}>
          {/* Régua de horas */}
          <div className="relative w-12 shrink-0 border-r border-line sm:w-14">
            {hours.map((hour, index) => (
              <div
                key={hour}
                className={cn(
                  "absolute right-1.5 text-[11px] tabular-nums text-ink-400",
                  // O primeiro rótulo fica alinhado ao topo; os demais centram
                  // na própria linha de hora.
                  index === 0 ? "translate-y-0.5" : "-translate-y-1/2",
                )}
                style={{ top: index * HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {columns.map((column) => {
            const laidOut = layoutOverlaps(column.appointments);

            return (
              <div
                key={column.key}
                className={cn(
                  "relative min-w-0 flex-1 border-r border-line last:border-r-0",
                  column.highlighted && "bg-rose-50/30",
                )}
              >
                {/* Linhas de hora e meia-hora + alvos de clique para criar */}
                {hours.map((hour, index) => (
                  <div key={hour}>
                    <div
                      className="absolute inset-x-0 border-t border-line"
                      style={{ top: index * HOUR_HEIGHT }}
                      aria-hidden
                    />
                    <div
                      className="absolute inset-x-0 border-t border-dashed border-line/60"
                      style={{ top: index * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                      aria-hidden
                    />
                    <button
                      type="button"
                      aria-label={`Agendar às ${String(hour).padStart(2, "0")}:00`}
                      onClick={() => {
                        const slot = new Date(column.dayStart);
                        slot.setTime(column.dayStart.getTime() + hour * 3_600_000);
                        onSelectSlot(slot, column.key);
                      }}
                      className="absolute inset-x-0 hover:bg-gold-50/70"
                      style={{ top: index * HOUR_HEIGHT, height: HOUR_HEIGHT / 2 }}
                    />
                    <button
                      type="button"
                      aria-label={`Agendar às ${String(hour).padStart(2, "0")}:30`}
                      onClick={() => {
                        const slot = new Date(column.dayStart);
                        slot.setTime(column.dayStart.getTime() + hour * 3_600_000 + 1_800_000);
                        onSelectSlot(slot, column.key);
                      }}
                      className="absolute inset-x-0 hover:bg-gold-50/70"
                      style={{
                        top: index * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                        height: HOUR_HEIGHT / 2,
                      }}
                    />
                  </div>
                ))}

                {laidOut.map(({ item, column: cardColumn, columns: cardColumns }) => (
                  <AppointmentCard
                    key={item.id}
                    appointment={item}
                    column={cardColumn}
                    columns={cardColumns}
                    startHour={startHour}
                    dayStart={column.dayStart}
                    onSelect={() => onSelectAppointment(item)}
                  />
                ))}

                {nowIsVisible && column.highlighted && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                    style={{ top: nowOffset }}
                    aria-hidden
                  >
                    <span className="size-2 shrink-0 rounded-full bg-rose-600" />
                    <span className="h-px flex-1 bg-rose-600" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { HOUR_HEIGHT };

/** Hora do dia (0–23) de um instante, no fuso do studio. */
export function studioHour(instant: Date): number {
  return toStudioTime(instant).getHours();
}
