import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aggregateExerciseSession,
  calculateEvolution,
  calculateExerciseHistory,
  calculateExerciseRecords,
  calculateMonthlyStats,
  calculateTrainingStreak,
  detectNewRecords,
} from "../src/lib/training-analytics";
import type { TrainingSet, WorkoutSession } from "../src/types";

const stamp = (date: string) => ({ toDate: () => new Date(`${date}T12:00:00Z`) }) as WorkoutSession["startedAt"];

function completedSession(id: string, date: string, sets: Array<Partial<TrainingSet>>, exerciseId = "supino"): WorkoutSession {
  const normalized = sets.map((set, index) => ({
    id: `set-${index}`,
    load: 0,
    reps: 0,
    completed: true,
    volume: 0,
    ...set,
  }));
  return {
    id,
    ownerId: "user-a",
    workoutId: "work-a",
    workoutName: "Treino A",
    startedAt: stamp(date),
    status: "completed",
    totalSets: normalized.filter((set) => set.completed).length,
    totalVolume: normalized.filter((set) => set.completed).reduce((sum, set) => sum + set.load * set.reps, 0),
    exercises: [{
      id: `item-${exerciseId}`,
      exerciseId,
      name: exerciseId === "supino" ? "Supino reto" : "Agachamento",
      order: 0,
      target: { id: "target", exerciseId, name: "Exercício", order: 0, sets: 3, repsMin: 8, repsMax: 12, restSeconds: 60 },
      sets: normalized,
    }],
  };
}

test("agrega somente séries concluídas e calcula volume real", () => {
  const session = completedSession("s1", "2026-08-01", [
    { load: 100, reps: 5, completed: true },
    { load: 90, reps: 8, completed: false },
    { load: 80, reps: 10, completed: true },
  ]);
  const [result] = aggregateExerciseSession(session);
  assert.equal(result.completedSets, 2);
  assert.equal(result.totalReps, 15);
  assert.equal(result.totalVolume, 1300);
  assert.deepEqual(result.bestSet, { load: 100, reps: 5, volume: 500 });
});

test("recordes e histórico são derivados por exerciseId", () => {
  const oldSession = completedSession("s1", "2026-08-01", [{ load: 80, reps: 10 }, { load: 80, reps: 8 }]);
  const newSession = completedSession("s2", "2026-08-08", [{ load: 100, reps: 6 }, { load: 90, reps: 12 }]);
  const records = calculateExerciseRecords([newSession, oldSession]).get("supino");
  assert.equal(records?.maxLoad, 100);
  assert.equal(records?.maxReps, 12);
  assert.equal(records?.maxSessionVolume, 1680);
  assert.deepEqual(calculateExerciseHistory([newSession, oldSession], "supino").map((item) => item.sessionId), ["s1", "s2"]);
});

test("detecta novos recordes sem gravar coleção paralela", () => {
  const previous = completedSession("s1", "2026-08-01", [{ load: 100, reps: 5 }]);
  const current = completedSession("s2", "2026-08-08", [{ load: 105, reps: 6 }]);
  assert.deepEqual(detectNewRecords([previous], current).map((item) => item.kind).sort(), ["load", "reps", "volume"]);
});

test("estatística mensal respeita mês e ano", () => {
  const sessions = [
    completedSession("current", "2026-08-03", [{ load: 10, reps: 10 }]),
    completedSession("old-year", "2025-08-03", [{ load: 50, reps: 10 }]),
    completedSession("other-month", "2026-07-31", [{ load: 50, reps: 10 }]),
  ];
  assert.deepEqual(calculateMonthlyStats(sessions, new Date("2026-08-18T12:00:00Z")), { workouts: 1, volume: 100, sets: 1 });
});

test("sequência semanal aceita a semana atual ou a imediatamente anterior", () => {
  const sessions = [
    completedSession("w1", "2026-08-17", [{ load: 10, reps: 1 }]),
    completedSession("w2", "2026-08-10", [{ load: 10, reps: 1 }]),
    completedSession("w3", "2026-08-03", [{ load: 10, reps: 1 }]),
  ];
  assert.equal(calculateTrainingStreak(sessions, new Date("2026-08-18T12:00:00Z")), 3);
  assert.equal(calculateTrainingStreak(sessions.slice(1), new Date("2026-08-18T12:00:00Z")), 2);
});

test("evolução não divide por zero", () => {
  assert.deepEqual(calculateEvolution(0, 10), { absolute: 10, percentage: null });
  assert.deepEqual(calculateEvolution(80, 100), { absolute: 20, percentage: 25 });
});
