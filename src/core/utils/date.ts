import { addDays, addMinutes, differenceInMinutes, startOfDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { studio } from "@/core/config/studio";

/**
 * Toda data no banco é um instante absoluto em UTC. Toda data na tela é o
 * horário de parede de Curitiba. Este módulo é a única ponte entre os dois.
 *
 * O motivo de não confiar no fuso do servidor: a Vercel roda em UTC. Se a
 * agenda calculasse "hoje" com o relógio do servidor, entre 21h e 00h de
 * Curitiba o app já estaria mostrando o dia seguinte.
 */
export const TIME_ZONE = studio.timeZone;

/** Instante UTC correspondente a 00:00 do dia (no fuso do studio). */
export function studioStartOfDay(instant: Date): Date {
  return fromZonedTime(startOfDay(toZonedTime(instant, TIME_ZONE)), TIME_ZONE);
}

/** Instante UTC correspondente a 00:00 do dia seguinte — limite superior exclusivo. */
export function studioEndOfDay(instant: Date): Date {
  return fromZonedTime(addDays(startOfDay(toZonedTime(instant, TIME_ZONE)), 1), TIME_ZONE);
}

/** Início da semana (segunda-feira, como se lê uma agenda no Brasil). */
export function studioStartOfWeek(instant: Date): Date {
  const zoned = toZonedTime(instant, TIME_ZONE);
  return fromZonedTime(startOfWeek(zoned, { weekStartsOn: 1 }), TIME_ZONE);
}

/** Instante UTC a partir de um horário de parede: ("2026-08-12", "14:30"). */
export function studioWallTimeToInstant(dateISO: string, timeHHmm: string): Date {
  return fromZonedTime(`${dateISO}T${timeHHmm}:00`, TIME_ZONE);
}

/** Componentes de calendário do instante, já no fuso do studio. */
export function toStudioTime(instant: Date): Date {
  return toZonedTime(instant, TIME_ZONE);
}

export function formatInStudio(instant: Date, pattern: string): string {
  return formatInTimeZone(instant, TIME_ZONE, pattern, { locale: ptBR });
}

/** "14:30" */
export const formatTime = (instant: Date) => formatInStudio(instant, "HH:mm");
/** "12/08/2026" */
export const formatDate = (instant: Date) => formatInStudio(instant, "dd/MM/yyyy");
/** "12/08/2026 às 14:30" */
export const formatDateTime = (instant: Date) => formatInStudio(instant, "dd/MM/yyyy 'às' HH:mm");
/** "quarta-feira, 12 de agosto" */
export const formatDayLong = (instant: Date) => formatInStudio(instant, "EEEE, d 'de' MMMM");
/** "agosto de 2026" */
export const formatMonthYear = (instant: Date) => formatInStudio(instant, "MMMM 'de' yyyy");

/** Valor para `<input type="date">` (sempre no fuso do studio). */
export const toDateInputValue = (instant: Date) => formatInStudio(instant, "yyyy-MM-dd");
/** Valor para `<input type="time">`. */
export const toTimeInputValue = (instant: Date) => formatInStudio(instant, "HH:mm");

/** Minutos desde a meia-noite do studio — usado para posicionar cards na grade. */
export function minutesFromStudioMidnight(instant: Date): number {
  return differenceInMinutes(instant, studioStartOfDay(instant));
}

/** Dois intervalos [aStart, aEnd) e [bStart, bEnd) se sobrepõem? */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** "1h30" · "45min" · "2h" */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h${String(rest).padStart(2, "0")}`;
}

/** Idade em anos a partir de "YYYY-MM-DD". */
export function ageFromBirthDate(birthDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;
  const [, year, month, day] = match;
  const today = toStudioTime(new Date());
  let age = today.getFullYear() - Number(year);
  const monthDiff = today.getMonth() + 1 - Number(month);
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < Number(day))) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

export { addDays, addMinutes, differenceInMinutes };
