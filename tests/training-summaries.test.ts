import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRecordTimeline,
  calculateExerciseProgression,
  calculateMonthlySummary,
  calculatePeriodWeightChange,
  calculateYearlySummary,
  findBiggestAbsoluteGain,
  findBiggestPercentageGain,
} from "../src/lib/training-summaries";
import type { BodyWeight, Exercise, TrainingSet, WorkoutSession } from "../src/types";

const stamp = (date: string) => ({ toDate: () => new Date(`${date}T12:00:00Z`) }) as WorkoutSession["startedAt"];

function set(overrides: Partial<TrainingSet> = {}): TrainingSet {
  return { id: `set-${Math.random()}`, load: 0, reps: 0, completed: true, volume: 0, setRole: "working", ...overrides };
}

function session(id: string, date: string, exerciseId: string, sets: TrainingSet[], overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id, ownerId: "user-a", workoutId: "work-a", workoutName: "Treino A",
    startedAt: stamp(date), status: "completed",
    totalSets: sets.filter((item) => item.completed).length,
    totalVolume: sets.filter((item) => item.completed).reduce((sum, item) => sum + item.load * item.reps, 0),
    durationSeconds: 1800,
    exercises: [{ id: `item-${exerciseId}`, exerciseId, name: exerciseId, order: 0, target: { id: "target", exerciseId, name: exerciseId, order: 0, sets: sets.length, repsMin: 8, repsMax: 12, restSeconds: 60, methodSnapshot: { id: "series-normais", name: "Séries normais", shortDescription: "", fullDescription: "", category: "traditional", engine: "normal", iconKey: "", order: 1, active: true, system: true, version: 1, capabilities: { sets: true, reps: true, load: true, rest: true, rir: false, rpe: false, tempo: false, duration: false, group: false }, exerciseRules: { minExercises: 1, maxExercises: 1 }, configFields: [], defaults: {} } }, sets }],
    ...overrides,
  };
}

const library: Exercise[] = [{ id: "supino", name: "Supino reto", muscleGroup: "Peito", active: true }];

test("comparação mensal calcula variação percentual de volume corretamente", () => {
  const current = [session("s1", "2026-08-05", "supino", [set({ load: 107.5, reps: 10 })])];
  const previous = [session("s0", "2026-07-05", "supino", [set({ load: 100, reps: 10 })])];
  const summary = calculateMonthlySummary({ year: 2026, month: 7, currentSessions: current, previousSessions: previous, recordBaselineSessions: [...previous, ...current], library, weights: [] });
  assert.equal(summary.previousVolume, 1000);
  assert.equal(summary.volume, 1075);
  assert.ok(Math.abs((summary.volumeChangePercent ?? 0) - 7.5) < 0.001);
});

test("mês anterior com volume zero retorna null, nunca divisão por zero", () => {
  const current = [session("s1", "2026-08-05", "supino", [set({ load: 100, reps: 10 })])];
  const summary = calculateMonthlySummary({ year: 2026, month: 7, currentSessions: current, previousSessions: [], recordBaselineSessions: current, library, weights: [] });
  assert.equal(summary.volumeChangePercent, null);
  assert.equal(summary.frequencyChangePercent, null);
});

test("resumo mensal não mistura o mesmo mês de anos diferentes", () => {
  const baseline = [
    session("jan25", "2025-01-10", "supino", [set({ load: 60, reps: 10 })]),
    session("jan26", "2026-01-10", "supino", [set({ load: 80, reps: 10 })]),
  ];
  const summary = calculateMonthlySummary({ year: 2026, month: 0, currentSessions: [baseline[1]], previousSessions: [], recordBaselineSessions: baseline, library, weights: [] });
  assert.equal(summary.sessionsCount, 1);
  assert.ok(summary.newRecords.every((event) => event.date.getUTCFullYear() === 2026));
});

test("buildRecordTimeline nunca duplica o mesmo recorde e processa em ordem cronológica", () => {
  const sessions = [
    session("s3", "2026-08-15", "supino", [set({ load: 100, reps: 10 })]),
    session("s1", "2026-08-01", "supino", [set({ load: 80, reps: 10 })]),
    session("s2", "2026-08-08", "supino", [set({ load: 80, reps: 10 })]),
  ];
  const timeline = buildRecordTimeline(sessions);
  const loadEvents = timeline.filter((event) => event.kind === "load");
  assert.equal(loadEvents.length, 2);
  assert.equal(loadEvents[0].sessionId, "s1");
  assert.equal(loadEvents[0].value, 80);
  assert.equal(loadEvents[1].sessionId, "s3");
  assert.equal(loadEvents[1].value, 100);
});

test("evolução de exercício: primeiro e último registro do período, não recorde histórico", () => {
  const sessions = [
    session("s1", "2026-01-05", "supino", [set({ load: 80, reps: 10 })]),
    session("s2", "2026-06-10", "supino", [set({ load: 100, reps: 10 })]),
  ];
  const progression = calculateExerciseProgression(sessions);
  const gain = findBiggestAbsoluteGain(progression)!;
  assert.equal(gain.first, 80);
  assert.equal(gain.last, 100);
  assert.equal(gain.absolute, 20);
  assert.ok(Math.abs((gain.percentage ?? 0) - 25) < 0.001);
});

test("evolução com primeiro valor zero retorna percentual nulo", () => {
  const sessions = [
    session("s1", "2026-01-05", "supino", [set({ load: 0, reps: 10 })]),
    session("s2", "2026-06-10", "supino", [set({ load: 20, reps: 10 })]),
  ];
  const progression = calculateExerciseProgression(sessions);
  assert.equal(findBiggestPercentageGain(progression), null);
  const absolute = findBiggestAbsoluteGain(progression)!;
  assert.equal(absolute.percentage, null);
});

test("variação de peso do período exige ao menos dois registros relevantes", () => {
  const weights: BodyWeight[] = [{ id: "w1", ownerId: "user-a", date: "2026-08-01", weight: 90 }];
  assert.equal(calculatePeriodWeightChange(weights, new Date(2026, 7, 1), new Date(2026, 8, 1)), null);
  const twoWeights: BodyWeight[] = [...weights, { id: "w2", ownerId: "user-a", date: "2026-08-28", weight: 87 }];
  const change = calculatePeriodWeightChange(twoWeights, new Date(2026, 7, 1), new Date(2026, 8, 1));
  assert.deepEqual(change, { start: 90, end: 87, change: -3 });
});

test("resumo anual filtra por ano e não mistura anos diferentes", () => {
  const sessions2025 = [session("y25", "2025-06-01", "supino", [set({ load: 50, reps: 10 })])];
  const sessions2026 = [session("y26a", "2026-02-01", "supino", [set({ load: 60, reps: 10 })]), session("y26b", "2026-11-01", "supino", [set({ load: 70, reps: 10 })])];
  const sessions2027 = [session("y27", "2027-01-15", "supino", [set({ load: 90, reps: 10 })])];
  const summary = calculateYearlySummary({ year: 2026, currentSessions: sessions2026, recordBaselineSessions: [...sessions2025, ...sessions2026, ...sessions2027], library, weights: [] });
  assert.equal(summary.sessionsCount, 2);
  assert.ok(summary.newRecords.every((event) => event.date.getUTCFullYear() === 2026));
});

test("ano sem nenhuma sessão retorna estado vazio consistente, sem lançar erro", () => {
  const summary = calculateYearlySummary({ year: 2026, currentSessions: [], recordBaselineSessions: [], library, weights: [] });
  assert.equal(summary.sessionsCount, 0);
  assert.equal(summary.volume, 0);
  assert.equal(summary.topExercise, null);
  assert.equal(summary.bestMonth, null);
  assert.equal(summary.weight, null);
  assert.equal(summary.biggestAbsoluteGain, null);
});
