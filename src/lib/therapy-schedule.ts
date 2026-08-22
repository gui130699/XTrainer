import type { MedicationSchedule } from "@/types";

const DAY_MS = 86400000;
const toDate = (value: string) => new Date(`${value}T12:00:00`);
const toISODate = (date: Date) => date.toISOString().slice(0, 10);

export interface ScheduleWindow {
  startDate: string;
  endDate?: string;
  continuous: boolean;
  schedule: MedicationSchedule;
}

export interface AdministrationLogEntry {
  scheduledDate: string;
}

// Gera as datas previstas dentro da janela [startDate, min(endDate, horizonDate)]. Para terapias
// contínuas (sem endDate) o horizonte informado pelo chamador é o único limite, evitando geração
// infinita de datas.
export function calculateScheduleDates(window: ScheduleWindow, horizonDate: Date): string[] {
  const start = toDate(window.startDate);
  const end = !window.continuous && window.endDate ? toDate(window.endDate) : horizonDate;
  const limit = end.getTime() < horizonDate.getTime() ? end : horizonDate;
  if (limit.getTime() < start.getTime()) return [];

  if (window.schedule.type === "interval") {
    const step = Math.max(1, Math.round(window.schedule.intervalDays));
    const dates: string[] = [];
    for (let cursor = start.getTime(); cursor <= limit.getTime(); cursor += step * DAY_MS) dates.push(toISODate(new Date(cursor)));
    return dates;
  }

  if (window.schedule.type === "weekdays") {
    const weekdays = new Set(window.schedule.weekdays);
    const dates: string[] = [];
    for (let cursor = start.getTime(); cursor <= limit.getTime(); cursor += DAY_MS) {
      if (weekdays.has(new Date(cursor).getDay())) dates.push(toISODate(new Date(cursor)));
    }
    return dates;
  }

  return window.schedule.dates
    .filter((value) => { const date = toDate(value); return date.getTime() >= start.getTime() && date.getTime() <= limit.getTime(); })
    .sort();
}

export function calculateNextAdministration(window: ScheduleWindow, log: AdministrationLogEntry[], referenceDate = new Date(), horizonDays = 365): string | null {
  const resolved = new Set(log.map((item) => item.scheduledDate));
  const horizon = new Date(referenceDate.getTime() + horizonDays * DAY_MS);
  const todayIso = toISODate(referenceDate);
  return calculateScheduleDates(window, horizon).find((date) => date >= todayIso && !resolved.has(date)) ?? null;
}

export function calculateDueAdministrations(window: ScheduleWindow, log: AdministrationLogEntry[], referenceDate = new Date()): string[] {
  const resolved = new Set(log.map((item) => item.scheduledDate));
  const todayIso = toISODate(referenceDate);
  return calculateScheduleDates(window, referenceDate).filter((date) => date === todayIso && !resolved.has(date));
}

export function calculateOverdueAdministrations(window: ScheduleWindow, log: AdministrationLogEntry[], referenceDate = new Date()): string[] {
  const resolved = new Set(log.map((item) => item.scheduledDate));
  const todayIso = toISODate(referenceDate);
  return calculateScheduleDates(window, referenceDate).filter((date) => date < todayIso && !resolved.has(date));
}
