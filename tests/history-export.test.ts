import assert from "node:assert/strict";
import { test } from "node:test";
import { buildExportRows, csvEscape, rowsToCsvText, sessionMatchesFilters } from "../src/lib/history-export";

const formatDate = (value: unknown) => (value instanceof Date ? value.toISOString().slice(0, 10) : "");

function makeSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "s1",
    ownerId: "u1",
    workoutId: "w1",
    workoutName: "Treino A",
    status: "completed",
    startedAt: new Date("2026-08-10T12:00:00.000Z"),
    totalSets: 1,
    totalVolume: 400,
    exercises: [
      {
        id: "e1",
        exerciseId: "ex1",
        name: "Supino",
        order: 1,
        target: { repsMin: 8, repsMax: 12, restSeconds: 90 },
        sets: [
          { id: "set1", load: 40, reps: 10, completed: true, volume: 400, methodId: "series-normais", methodEngine: "normal", methodVersion: 1, setRole: "working" },
          { id: "set2", load: 40, reps: 10, completed: false, volume: 0, methodId: "series-normais", methodEngine: "normal", methodVersion: 1, setRole: "working" },
        ],
      },
    ],
    ...overrides,
  } as never;
}

test("sessionMatchesFilters filtra por período em relação a um horário de referência", () => {
  const session = makeSession({ startedAt: new Date("2026-08-01T00:00:00.000Z") });
  const referenceTime = new Date("2026-08-22T00:00:00.000Z").getTime();
  assert.equal(sessionMatchesFilters(session, { period: "7", workout: "", exercise: "", referenceTime }), false);
  assert.equal(sessionMatchesFilters(session, { period: "30", workout: "", exercise: "", referenceTime }), true);
  assert.equal(sessionMatchesFilters(session, { period: "all", workout: "", exercise: "", referenceTime }), true);
});

test("sessionMatchesFilters filtra por nome do treino e por exercício (ignorando acentos)", () => {
  const session = makeSession();
  const referenceTime = Date.now();
  assert.equal(sessionMatchesFilters(session, { period: "all", workout: "Treino B", exercise: "", referenceTime }), false);
  assert.equal(sessionMatchesFilters(session, { period: "all", workout: "Treino A", exercise: "", referenceTime }), true);
  assert.equal(sessionMatchesFilters(session, { period: "all", workout: "", exercise: "supinó", referenceTime }), true);
  assert.equal(sessionMatchesFilters(session, { period: "all", workout: "", exercise: "agachamento", referenceTime }), false);
});

test("buildExportRows gera uma linha por série concluída, ignorando séries não concluídas", () => {
  const rows = buildExportRows([makeSession()], formatDate);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].exerciseName, "Supino");
  assert.equal(rows[0].workoutName, "Treino A");
  assert.equal(rows[0].volume, "400");
});

test("csvEscape só envolve em aspas quando o valor contém separador, aspas ou quebra de linha", () => {
  assert.equal(csvEscape("Supino Reto"), "Supino Reto");
  assert.equal(csvEscape("Treino; Peito"), '"Treino; Peito"');
  assert.equal(csvEscape('Diz "oi"'), '"Diz ""oi"""');
});

test("rowsToCsvText inclui o cabeçalho e uma linha por registro, separados por ponto e vírgula", () => {
  const rows = buildExportRows([makeSession()], formatDate);
  const csv = rowsToCsvText(rows);
  const lines = csv.split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^Data;Treino;Exercício/);
  assert.match(lines[1], /Treino A;Supino/);
});
