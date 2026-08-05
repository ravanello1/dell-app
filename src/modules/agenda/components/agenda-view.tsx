"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addDays, addMonths, startOfMonth, startOfWeek } from "date-fns";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/core/utils/cn";
import {
  formatDayLong,
  formatInStudio,
  formatMonthYear,
  studioStartOfDay,
  studioStartOfWeek,
  toDateInputValue,
  toStudioTime,
} from "@/core/utils/date";
import { fromZonedTime } from "date-fns-tz";
import { TIME_ZONE } from "@/core/utils/date";
import { Button } from "@/ui/button";
import { ErrorState, LoadingBlock } from "@/ui/feedback";
import { useAgendaRange, useProfessionals } from "../agenda.api";
import { AgendaList } from "./agenda-list";
import { AppointmentDialog } from "./appointment-dialog";
import { CalendarGrid, type CalendarColumn } from "./calendar-grid";
import { CalendarMonth } from "./calendar-month";
import type { AppointmentDto } from "../agenda.dto";

/**
 * Orquestrador da agenda.
 *
 * O estado da tela (dia, visão, profissional) vive na URL. Assim recarregar não
 * perde o lugar, dá para mandar o link de um dia específico para alguém, e o
 * botão de voltar do navegador funciona como se espera.
 */

type ViewMode = "dia" | "semana" | "mes";

/** Faixa de horas desenhada na grade. Cobre o expediente com folga nas pontas. */
const START_HOUR = 7;
const END_HOUR = 22;

function parseDate(value: string | null): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // "2026-08-12" é meia-noite em Curitiba, não em UTC.
    return fromZonedTime(`${value}T00:00:00`, TIME_ZONE);
  }
  return studioStartOfDay(new Date());
}

function parseView(value: string | null): ViewMode {
  return value === "semana" || value === "mes" ? value : "dia";
}

export function AgendaView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const anchor = parseDate(searchParams.get("d"));
  const view = parseView(searchParams.get("v"));
  const professionalFilter = searchParams.get("p") ?? "";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppointmentDto | undefined>();
  const [suggestedStart, setSuggestedStart] = useState<Date | undefined>();
  const [suggestedProfessionalId, setSuggestedProfessionalId] = useState<string | undefined>();

  const professionalsQuery = useProfessionals();
  const professionals = useMemo(() => professionalsQuery.data ?? [], [professionalsQuery.data]);

  /** Reescreve a URL preservando o que não mudou. */
  const setParams = useCallback(
    (next: { d?: Date; v?: ViewMode; p?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.d) params.set("d", toDateInputValue(next.d));
      if (next.v) params.set("v", next.v);
      if (next.p !== undefined) {
        if (next.p) params.set("p", next.p);
        else params.delete("p");
      }
      router.replace(`/agenda?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // ── Janela consultada, conforme a visão ─────────────────────────────────
  const { from, to, days } = useMemo(() => {
    if (view === "dia") {
      const start = studioStartOfDay(anchor);
      return { from: start, to: addDays(start, 1), days: [start] };
    }

    if (view === "semana") {
      const start = studioStartOfWeek(anchor);
      return {
        from: start,
        to: addDays(start, 7),
        days: Array.from({ length: 7 }, (_, index) => addDays(start, index)),
      };
    }

    // Mês: a grade começa na segunda da semana do dia 1 e cobre 42 dias.
    const monthStart = startOfMonth(toStudioTime(anchor));
    const gridStart = fromZonedTime(
      startOfWeek(monthStart, { weekStartsOn: 1 }),
      TIME_ZONE,
    );
    return { from: gridStart, to: addDays(gridStart, 42), days: [gridStart] };
  }, [anchor, view]);

  const agendaQuery = useAgendaRange({
    from: from.toISOString(),
    to: to.toISOString(),
    professionalId: professionalFilter || undefined,
  });

  const appointments = useMemo(() => agendaQuery.data ?? [], [agendaQuery.data]);

  // ── Colunas da grade ────────────────────────────────────────────────────
  const columns: CalendarColumn[] = useMemo(() => {
    const todayKey = studioStartOfDay(new Date()).getTime();

    if (view === "dia") {
      const dayStart = days[0]!;
      const visible = professionalFilter
        ? professionals.filter((professional) => professional.id === professionalFilter)
        : professionals;

      // No dia, cada profissional ganha uma coluna — é assim que se enxerga
      // quem está livre quando a cliente pergunta "tem horário hoje?".
      return visible.map((professional) => ({
        key: professional.id,
        label: professional.name,
        color: professional.color,
        highlighted: dayStart.getTime() === todayKey,
        dayStart,
        appointments: appointments.filter(
          (appointment) => appointment.professional.id === professional.id,
        ),
      }));
    }

    return days.map((day) => {
      const dayStart = studioStartOfDay(day);
      const nextDay = addDays(dayStart, 1);
      return {
        key: toDateInputValue(day),
        label: formatInStudio(day, "EEEEEE"),
        sublabel: formatInStudio(day, "d/MM"),
        highlighted: dayStart.getTime() === todayKey,
        dayStart,
        appointments: appointments.filter((appointment) => {
          const start = new Date(appointment.startAt);
          return start >= dayStart && start < nextDay;
        }),
      };
    });
  }, [appointments, days, professionalFilter, professionals, view]);

  // ── Navegação temporal ──────────────────────────────────────────────────
  function step(direction: 1 | -1) {
    if (view === "dia") setParams({ d: addDays(anchor, direction) });
    else if (view === "semana") setParams({ d: addDays(anchor, direction * 7) });
    else setParams({ d: fromZonedTime(addMonths(toStudioTime(anchor), direction), TIME_ZONE) });
  }

  function openNew(start?: Date, professionalId?: string) {
    setEditing(undefined);
    setSuggestedStart(start);
    setSuggestedProfessionalId(professionalId);
    setDialogOpen(true);
  }

  function openExisting(appointment: AppointmentDto) {
    setEditing(appointment);
    setSuggestedStart(undefined);
    setSuggestedProfessionalId(undefined);
    setDialogOpen(true);
  }

  const periodLabel =
    view === "dia"
      ? formatDayLong(anchor)
      : view === "semana"
        ? `${formatInStudio(days[0]!, "d MMM")} – ${formatInStudio(days[6]!, "d MMM")}`
        : formatMonthYear(anchor);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Barra de controle ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Período anterior"
              className="rounded-full p-2 text-ink-600 transition-colors hover:bg-gold-50 hover:text-gold-800"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setParams({ d: studioStartOfDay(new Date()) })}
              className="rounded-(--radius-field) border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:bg-gold-50"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Próximo período"
              className="rounded-full p-2 text-ink-600 transition-colors hover:bg-gold-50 hover:text-gold-800"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>

          <Button size="sm" onClick={() => openNew()}>
            <CalendarPlus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Novo atendimento</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>

        <p className="text-lg text-ink-900 first-letter:uppercase sm:text-xl">{periodLabel}</p>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de visão */}
          <div
            role="tablist"
            aria-label="Modo de visualização"
            className="inline-flex rounded-(--radius-field) border border-line-strong bg-surface p-0.5"
          >
            {(["dia", "semana", "mes"] as const).map((mode) => (
              <button
                key={mode}
                role="tab"
                aria-selected={view === mode}
                type="button"
                onClick={() => setParams({ v: mode })}
                className={cn(
                  "rounded-[0.4rem] px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  view === mode
                    ? "bg-rose-600 text-white"
                    : "text-ink-600 hover:bg-gold-50 hover:text-gold-800",
                )}
              >
                {mode === "mes" ? "mês" : mode}
              </button>
            ))}
          </div>

          {professionals.length > 1 && (
            <select
              value={professionalFilter}
              onChange={(event) => setParams({ p: event.target.value })}
              aria-label="Filtrar por profissional"
              className="rounded-(--radius-field) border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-700"
            >
              <option value="">Todas as profissionais</option>
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Conteúdo ───────────────────────────────────────────────────── */}
      {agendaQuery.isError ? (
        <ErrorState
          message={agendaQuery.error.message}
          retry={
            <Button variant="secondary" size="sm" onClick={() => agendaQuery.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : agendaQuery.isPending || professionalsQuery.isPending ? (
        <LoadingBlock label="Carregando a agenda…" />
      ) : view === "mes" ? (
        <CalendarMonth
          monthStart={from}
          appointments={appointments}
          onSelectDay={(day) => setParams({ d: day, v: "dia" })}
          onSelectAppointment={openExisting}
        />
      ) : (
        <>
          {/* Grade a partir de telas médias… */}
          <div className="hidden md:block">
            <CalendarGrid
              columns={columns}
              startHour={START_HOUR}
              endHour={END_HOUR}
              onSelectAppointment={openExisting}
              onSelectSlot={(start, columnKey) =>
                openNew(start, view === "dia" ? columnKey : professionalFilter || undefined)
              }
            />
          </div>

          {/* …e lista no celular, onde 7 colunas seriam ilegíveis */}
          <div className="md:hidden">
            {view === "dia" ? (
              <CalendarGrid
                columns={columns}
                startHour={START_HOUR}
                endHour={END_HOUR}
                onSelectAppointment={openExisting}
                onSelectSlot={(start, columnKey) => openNew(start, columnKey)}
              />
            ) : (
              <AgendaList
                appointments={appointments}
                onSelect={openExisting}
                emptyMessage="Nenhum atendimento marcado nesta semana."
              />
            )}
          </div>
        </>
      )}

      {/* A `key` muda a cada abertura, então o diálogo remonta com os valores
          certos em vez de depender de um efeito que reseta o estado. */}
      <AppointmentDialog
        key={`${editing?.id ?? "novo"}-${suggestedStart?.getTime() ?? 0}-${String(dialogOpen)}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        appointment={editing}
        suggestedStart={suggestedStart}
        suggestedProfessionalId={suggestedProfessionalId}
      />
    </div>
  );
}
