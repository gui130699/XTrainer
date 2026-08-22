import assert from "node:assert/strict";
import { test } from "node:test";
import { applyExerciseSkip, applyExerciseSwap, groupRoundRestOverride, isGroupSessionComplete, undoExerciseSkip } from "../src/lib/training-methods";
import { aggregateExerciseSession } from "../src/lib/training-analytics";
import type { SessionExercise, TrainingSet, WorkoutExerciseGroup, WorkoutSession } from "../src/types";

const target = (overrides: Partial<SessionExercise["target"]> = {}): SessionExercise["target"] => ({
  id: "target", exerciseId: "supino-reto", name: "Supino reto", order: 0, sets: 2, repsMin: 8, repsMax: 12, restSeconds: 90, ...overrides,
});

const trainingSet = (overrides: Partial<TrainingSet> = {}): TrainingSet => ({
  id: `set-${Math.random()}`, load: 0, reps: 0, completed: false, volume: 0, setRole: "working", ...overrides,
});

const sessionExercise = (overrides: Partial<SessionExercise> = {}): SessionExercise => ({
  id: "item-a", exerciseId: "supino-reto", name: "Supino reto", order: 0, target: target(), sets: [], ...overrides,
});

function sessionWith(exercises: SessionExercise[], exerciseGroups: WorkoutExerciseGroup[] = []): WorkoutSession {
  return {
    id: "session-a", ownerId: "user-a", workoutId: "work-a", workoutName: "Treino A",
    startedAt: { toDate: () => new Date("2026-08-01T12:00:00Z") } as WorkoutSession["startedAt"],
    status: "completed", exercises, exerciseGroups,
    totalVolume: exercises.flatMap((item) => item.sets).filter((set) => set.completed).reduce((sum, set) => sum + set.load * set.reps, 0),
    totalSets: exercises.flatMap((item) => item.sets).filter((set) => set.completed).length,
  };
}

test("troca só nesta sessão altera apenas o SessionExercise, preservando o exercício original", () => {
  const exercise = sessionExercise({ sets: [trainingSet({ id: "s1", load: 80, reps: 10, completed: true })] });
  const swapped = applyExerciseSwap(exercise, { id: "supino-maquina", name: "Supino máquina" }, "session-only");
  assert.equal(swapped.exerciseId, "supino-maquina");
  assert.equal(swapped.name, "Supino máquina");
  assert.equal(swapped.substitutionType, "session-only");
  assert.equal(swapped.originalExerciseId, "supino-reto");
  assert.equal(swapped.originalExerciseName, "Supino reto");
});

test("troca preserva a identidade real das séries já concluídas antes da troca", () => {
  const exercise = sessionExercise({
    sets: [
      trainingSet({ id: "s1", load: 80, reps: 10, completed: true }),
      trainingSet({ id: "s2", load: 80, reps: 9, completed: true }),
      trainingSet({ id: "s3", load: 0, reps: 0, completed: false }),
      trainingSet({ id: "s4", load: 0, reps: 0, completed: false }),
    ],
  });
  const swapped = applyExerciseSwap(exercise, { id: "supino-maquina", name: "Supino máquina" }, "session-only");
  const [s1, s2, s3, s4] = swapped.sets;
  assert.equal(s1.actualExerciseId, "supino-reto");
  assert.equal(s1.actualExerciseName, "Supino reto");
  assert.equal(s2.actualExerciseId, "supino-reto");
  assert.equal(s3.actualExerciseId, undefined);
  assert.equal(s4.actualExerciseId, undefined);

  const completedSets = swapped.sets.filter((set) => set.completed).map((set) => ({ ...set, load: 80, reps: 10 }));
  const finished = { ...swapped, sets: [...completedSets, trainingSet({ id: "s3", load: 60, reps: 12, completed: true }), trainingSet({ id: "s4", load: 0, reps: 0, completed: false })] };
  const session = sessionWith([finished]);
  const aggregates = aggregateExerciseSession(session);
  assert.equal(aggregates.length, 2);
  const oldExercise = aggregates.find((item) => item.exerciseId === "supino-reto")!;
  const newExercise = aggregates.find((item) => item.exerciseId === "supino-maquina")!;
  assert.equal(oldExercise.completedSets, 2);
  assert.equal(newExercise.completedSets, 1);
  assert.equal(newExercise.name, "Supino máquina");
});

test("segunda troca preserva o exerciseId original planejado, não o intermediário", () => {
  const exercise = sessionExercise();
  const first = applyExerciseSwap(exercise, { id: "supino-maquina", name: "Supino máquina" }, "session-only");
  const second = applyExerciseSwap(first, { id: "supino-halteres", name: "Supino com halteres" }, "session-only");
  assert.equal(second.originalExerciseId, "supino-reto");
  assert.equal(second.exerciseId, "supino-halteres");
});

test("pular hoje com zero séries concluídas não gera volume nem séries concluídas", () => {
  const exercise = sessionExercise({ sets: Array.from({ length: 4 }, (_, index) => trainingSet({ id: `s${index}` })) });
  const skipped = applyExerciseSkip(exercise, "equipment-busy");
  assert.equal(skipped.skipInfo?.skipped, true);
  assert.equal(skipped.skipInfo?.reasonCode, "equipment-busy");
  assert.ok(skipped.sets.every((set) => set.skipped === true));
  const session = sessionWith([skipped]);
  assert.deepEqual(aggregateExerciseSession(session), []);
  assert.equal(session.totalVolume, 0);
  assert.equal(session.totalSets, 0);
});

test("pular hoje preserva séries já concluídas e só marca as pendentes", () => {
  const exercise = sessionExercise({
    sets: [
      trainingSet({ id: "s1", load: 40, reps: 12, completed: true }),
      trainingSet({ id: "s2", load: 40, reps: 12, completed: true }),
      trainingSet({ id: "s3" }),
      trainingSet({ id: "s4" }),
    ],
  });
  const skipped = applyExerciseSkip(exercise, undefined, "Motivo livre");
  assert.equal(skipped.sets[0].completed, true);
  assert.equal(skipped.sets[0].skipped, undefined);
  assert.equal(skipped.sets[1].completed, true);
  assert.equal(skipped.sets[2].skipped, true);
  assert.equal(skipped.sets[3].skipped, true);
  const session = sessionWith([skipped]);
  const [aggregate] = aggregateExerciseSession(session);
  assert.equal(aggregate.completedSets, 2);
  assert.equal(aggregate.totalVolume, 960);
});

test("desfazer pulo restaura as séries pendentes normalmente", () => {
  const exercise = sessionExercise({ sets: [trainingSet({ id: "s1", completed: true, load: 10, reps: 10 }), trainingSet({ id: "s2" })] });
  const skipped = applyExerciseSkip(exercise);
  const restored = undoExerciseSkip(skipped);
  assert.equal(restored.skipInfo, undefined);
  assert.ok(restored.sets.every((set) => set.skipped === undefined));
  assert.equal(restored.sets[0].completed, true);
});

test("grupo: descanso após rodada só é liberado quando os membros não pulados terminam", () => {
  const group: WorkoutExerciseGroup = {
    id: "group-a", name: "Bi-set", order: 1, exerciseIds: ["a", "b"],
    methodSnapshot: { id: "bi-set", name: "Bi-set", shortDescription: "", fullDescription: "", category: "group", engine: "group", iconKey: "", order: 1, active: true, system: true, version: 1, capabilities: { sets: true, reps: true, load: true, rest: true, rir: false, rpe: false, tempo: false, duration: false, group: true }, exerciseRules: { minExercises: 2, maxExercises: 2 }, configFields: [], defaults: {} },
    methodConfig: { methodId: "bi-set", values: { restAfterRound: 90, restBetweenExercises: 0 } },
  };
  const memberA = sessionExercise({ id: "a", exerciseId: "rosca", name: "Rosca direta", target: target({ id: "a", groupId: "group-a", groupPosition: 0 }), sets: [trainingSet({ id: "a1" })] });
  const memberB = sessionExercise({ id: "b", exerciseId: "triceps", name: "Tríceps corda", target: target({ id: "b", groupId: "group-a", groupPosition: 1 }), sets: [trainingSet({ id: "b1" })] });

  const beforeAnyCompleted = sessionWith([memberA, memberB], [group]);
  assert.equal(groupRoundRestOverride(beforeAnyCompleted, memberA, 0), null);

  const skippedA = applyExerciseSkip(memberA);
  const sessionAfterSkipA = sessionWith([skippedA, memberB], [group]);
  const bCompleted = { ...memberB, sets: [{ ...memberB.sets[0], completed: true }] };
  const sessionBDone = sessionWith([skippedA, bCompleted], [group]);
  assert.equal(groupRoundRestOverride(sessionBDone, bCompleted, 0), 90);
  assert.equal(isGroupSessionComplete(sessionBDone, group), true);
  assert.equal(isGroupSessionComplete(sessionAfterSkipA, group), false);
});

test("grupo totalmente pulado é considerado concluído sem exigir descanso", () => {
  const group: WorkoutExerciseGroup = {
    id: "group-a", name: "Bi-set", order: 1, exerciseIds: ["a", "b"],
    methodSnapshot: { id: "bi-set", name: "Bi-set", shortDescription: "", fullDescription: "", category: "group", engine: "group", iconKey: "", order: 1, active: true, system: true, version: 1, capabilities: { sets: true, reps: true, load: true, rest: true, rir: false, rpe: false, tempo: false, duration: false, group: true }, exerciseRules: { minExercises: 2, maxExercises: 2 }, configFields: [], defaults: {} },
    methodConfig: { methodId: "bi-set", values: { restAfterRound: 90 } },
  };
  const memberA = applyExerciseSkip(sessionExercise({ id: "a", target: target({ groupId: "group-a", groupPosition: 0 }), sets: [trainingSet({ id: "a1" })] }));
  const memberB = applyExerciseSkip(sessionExercise({ id: "b", target: target({ groupId: "group-a", groupPosition: 1 }), sets: [trainingSet({ id: "b1" })] }));
  const session = sessionWith([memberA, memberB], [group]);
  assert.equal(isGroupSessionComplete(session, group), true);
  assert.equal(groupRoundRestOverride(session, memberA, 0), 0);
});
