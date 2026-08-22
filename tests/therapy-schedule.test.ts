import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateDueAdministrations, calculateNextAdministration, calculateOverdueAdministrations, calculateScheduleDates } from "../src/lib/therapy-schedule";
import type { ScheduleWindow } from "../src/lib/therapy-schedule";

const at = (value: string) => new Date(`${value}T12:00:00`);

test("intervalo de 7 dias gera datas a partir do início até o horizonte", () => {
  const window: ScheduleWindow = { startDate: "2026-08-22", continuous: true, schedule: { type: "interval", intervalDays: 7 } };
  assert.deepEqual(calculateScheduleDates(window, at("2026-09-15")), ["2026-08-22", "2026-08-29", "2026-09-05", "2026-09-12"]);
});

test("terapia contínua nunca gera datas além do horizonte informado (sem loop infinito)", () => {
  const window: ScheduleWindow = { startDate: "2020-01-01", continuous: true, schedule: { type: "interval", intervalDays: 1 } };
  const dates = calculateScheduleDates(window, at("2020-01-10"));
  assert.equal(dates.length, 10);
  assert.equal(dates.at(-1), "2020-01-10");
});

test("terapia com data final não gera nenhuma ocorrência após o término", () => {
  const window: ScheduleWindow = { startDate: "2026-08-01", endDate: "2026-08-15", continuous: false, schedule: { type: "interval", intervalDays: 7 } };
  const dates = calculateScheduleDates(window, at("2026-12-31"));
  assert.deepEqual(dates, ["2026-08-01", "2026-08-08", "2026-08-15"]);
});

test("dias da semana geram apenas as ocorrências nos dias selecionados (0=domingo)", () => {
  const window: ScheduleWindow = { startDate: "2026-08-17", continuous: true, schedule: { type: "weekdays", weekdays: [1, 4] } };
  const dates = calculateScheduleDates(window, at("2026-08-31"));
  assert.deepEqual(dates, ["2026-08-17", "2026-08-20", "2026-08-24", "2026-08-27", "2026-08-31"]);
});

test("datas personalizadas são preservadas e ordenadas, ignorando as fora da janela", () => {
  const window: ScheduleWindow = { startDate: "2026-08-01", endDate: "2026-08-31", continuous: false, schedule: { type: "custom", dates: ["2026-08-20", "2026-08-05", "2026-09-01"] } };
  assert.deepEqual(calculateScheduleDates(window, at("2026-12-31")), ["2026-08-05", "2026-08-20"]);
});

test("uma administração registrada deixa de aparecer como próxima, atrasada ou do dia", () => {
  const window: ScheduleWindow = { startDate: "2026-08-20", continuous: true, schedule: { type: "interval", intervalDays: 2 } };
  const reference = at("2026-08-24");
  const withoutLog = calculateNextAdministration(window, [], reference);
  assert.equal(withoutLog, "2026-08-24");
  const withLog = calculateNextAdministration(window, [{ scheduledDate: "2026-08-24" }], reference);
  assert.equal(withLog, "2026-08-26");
});

test("calculateDueAdministrations retorna apenas ocorrências do dia de referência não resolvidas", () => {
  const window: ScheduleWindow = { startDate: "2026-08-20", continuous: true, schedule: { type: "interval", intervalDays: 2 } };
  assert.deepEqual(calculateDueAdministrations(window, [], at("2026-08-24")), ["2026-08-24"]);
  assert.deepEqual(calculateDueAdministrations(window, [{ scheduledDate: "2026-08-24" }], at("2026-08-24")), []);
});

test("calculateOverdueAdministrations retorna apenas datas passadas sem registro", () => {
  const window: ScheduleWindow = { startDate: "2026-08-20", continuous: true, schedule: { type: "interval", intervalDays: 2 } };
  const overdue = calculateOverdueAdministrations(window, [{ scheduledDate: "2026-08-20" }], at("2026-08-26"));
  assert.deepEqual(overdue, ["2026-08-22", "2026-08-24"]);
});
