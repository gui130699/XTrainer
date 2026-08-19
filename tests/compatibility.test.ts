import assert from "node:assert/strict";
import { test } from "node:test";
import { compareAssessments } from "../src/lib/body-assessments";
import {
  normalizeAssessmentDocument,
  normalizeBodyWeightDocument,
  normalizeExerciseDocument,
  normalizeWorkoutDocument,
  normalizeWorkoutSessionDocument,
} from "../src/lib/compatibility";

test("readers aceitam exercício, treino e peso anteriores aos campos novos", () => {
  assert.equal(normalizeExerciseDocument("old-ex", { name: "Remada", muscleGroup: "Costas" }).active, true);
  const workout = normalizeWorkoutDocument("old-work", { ownerId: "u", name: "A", exercises: [] });
  assert.equal(workout.title, "A");
  assert.equal(workout.active, true);
  const weight = normalizeBodyWeightDocument("old-weight", { ownerId: "u", date: "2026-01-01", weight: 80 });
  assert.equal(weight.source, undefined);
});

test("reader de sessão recompõe campos derivados sem exigir novos atributos", () => {
  const session = normalizeWorkoutSessionDocument("old-session", {
    ownerId: "u",
    workoutName: "Treino antigo",
    endedAt: { seconds: 1 },
    exercises: [{ name: "Supino", sets: [{ load: 50, reps: 10, completed: true }] }],
  });
  assert.equal(session.status, "completed");
  assert.equal(session.totalSets, 1);
  assert.equal(session.totalVolume, 500);
  assert.equal(session.exercises[0].sets[0].id, "legacy-set-0");
});

test("avaliação parcial antiga continua legível", () => {
  const assessment = normalizeAssessmentDocument("old-assessment", { ownerId: "u", date: "2025-01-01", weight: 81 });
  assert.equal(assessment.type, "quick");
  assert.deepEqual(assessment.measurements, {});
  const complete = normalizeAssessmentDocument("old-complete", { ownerId: "u", date: "2025-02-01", measurements: { waist: 90 } });
  assert.equal(complete.type, "complete");
});

test("comparação usa apenas valores existentes nas duas avaliações", () => {
  const before = normalizeAssessmentDocument("a", { ownerId: "u", date: "2026-01-01", weight: 80, measurements: { waist: 90 }, skinfolds: { triceps: 12 } });
  const after = normalizeAssessmentDocument("b", { ownerId: "u", date: "2026-02-01", weight: 78, bodyFat: 15, measurements: { waist: 86 }, skinfolds: { triceps: 10 } });
  const rows = compareAssessments(before, after);
  assert.deepEqual(rows.map((item) => [item.key, item.difference]), [["weight", -2], ["measurement.waist", -4], ["skinfold.triceps", -2]]);
});
