import assert from "node:assert/strict";
import { test } from "node:test";
import { buildIcsFile, buildTherapyCalendarEvents, buildTherapyIcs, CONTINUOUS_DEFAULT_HORIZON_DAYS } from "../src/lib/therapy-calendar-export";
import type { Therapy } from "../src/types";

const baseTherapy = (overrides: Partial<Therapy> = {}): Therapy => ({
  id: "therapy-1",
  ownerId: "user-1",
  name: "Tratamento X",
  startDate: "2026-08-22",
  continuous: false,
  status: "active",
  medications: [{ id: "med-1", name: "Medicamento A", schedule: { type: "interval", intervalDays: 7 } }],
  ...overrides,
});

test("terapia contínua respeita o horizonte solicitado e não gera agenda infinita", () => {
  const therapy = baseTherapy({ continuous: true });
  const events = buildTherapyCalendarEvents(therapy, 30, new Date("2026-08-22T12:00:00"));
  assert.equal(events.length, 5);
  assert.equal(events.at(-1)?.date, "2026-09-19");
});

test("terapia com data final não ultrapassa o término, mesmo com horizonte maior", () => {
  const therapy = baseTherapy({ endDate: "2026-08-29" });
  const events = buildTherapyCalendarEvents(therapy, 90, new Date("2026-08-22T12:00:00"));
  assert.deepEqual(events.map((event) => event.date), ["2026-08-22", "2026-08-29"]);
});

test("buildTherapyIcs usa o horizonte padrão de 90 dias quando não informado", () => {
  const therapy = baseTherapy({ continuous: true });
  const ics = buildTherapyIcs(therapy, undefined, new Date("2026-08-22T12:00:00"));
  const occurrences = ics.match(/BEGIN:VEVENT/g)?.length ?? 0;
  assert.equal(occurrences, Math.floor(CONTINUOUS_DEFAULT_HORIZON_DAYS / 7) + 1);
});

test("buildIcsFile produz um calendário válido com escape de texto", () => {
  const ics = buildIcsFile([{ uid: "abc@xtrainer", date: "2026-08-22", title: "Medicamento, com vírgula", description: "Linha 1\nLinha 2" }], new Date("2026-08-22T10:00:00Z"));
  assert.ok(ics.startsWith("BEGIN:VCALENDAR"));
  assert.ok(ics.endsWith("END:VCALENDAR"));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20260822"));
  assert.ok(ics.includes("SUMMARY:Medicamento\\, com vírgula"));
  assert.ok(ics.includes("DESCRIPTION:Linha 1\\nLinha 2"));
});
