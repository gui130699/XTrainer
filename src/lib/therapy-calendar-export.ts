import { calculateScheduleDates } from "@/lib/therapy-schedule";
import type { Therapy } from "@/types";

export const CONTINUOUS_DEFAULT_HORIZON_DAYS = 90;
const DAY_MS = 86400000;

export interface TherapyCalendarEvent {
  uid: string;
  date: string;
  title: string;
  description: string;
}

// Terapias com data final exportam até o fim do tratamento (ou o horizonte, o que vier primeiro).
// Terapias contínuas nunca geram agenda infinita: sempre respeitam o horizonte solicitado.
export function buildTherapyCalendarEvents(therapy: Therapy, horizonDays: number, referenceDate = new Date()): TherapyCalendarEvent[] {
  const horizon = new Date(referenceDate.getTime() + Math.max(1, horizonDays) * DAY_MS);
  const events: TherapyCalendarEvent[] = [];
  for (const medication of therapy.medications) {
    const dates = calculateScheduleDates({ startDate: therapy.startDate, endDate: therapy.endDate, continuous: therapy.continuous, schedule: medication.schedule }, horizon);
    for (const date of dates) {
      events.push({
        uid: `${therapy.id}-${medication.id}-${date}@xtrainer`,
        date,
        title: medication.name,
        description: `Terapia: ${therapy.name}${medication.formulation ? ` · ${medication.formulation}` : ""}`,
      });
    }
  }
  return events;
}

const escapeIcsText = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function buildIcsFile(events: TherapyCalendarEvent[], stamp = new Date()): string {
  const dtstamp = `${stamp.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//XTrainer//Saude e Terapias//PT",
    "CALSCALE:GREGORIAN",
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${event.date.replace(/-/g, "")}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `DESCRIPTION:${escapeIcsText(event.description)}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

export function buildTherapyIcs(therapy: Therapy, horizonDays = CONTINUOUS_DEFAULT_HORIZON_DAYS, referenceDate = new Date()): string {
  return buildIcsFile(buildTherapyCalendarEvents(therapy, horizonDays, referenceDate), referenceDate);
}
