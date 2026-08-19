import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_TRAINING_METHODS } from "../src/data/default-training-methods";
import { createMethodConfig, createTrainingSets, isWorkingSet, snapshotMethod } from "../src/lib/training-methods";
import type { TrainingMethod, Workout, WorkoutExercise } from "../src/types";

const byId = (id: string) => DEFAULT_TRAINING_METHODS.find((item) => item.id === id)!;
const exercise = (method: TrainingMethod, id = "exercise-a"): WorkoutExercise => ({ id, exerciseId: id, name: id, order: 1, sets: 2, repsMin: 10, repsMax: 12, restSeconds: 90, suggestedLoad: 80, methodSnapshot: snapshotMethod(method), methodConfig: createMethodConfig(method) });
const workout = (items: WorkoutExercise[], exerciseGroups: Workout["exerciseGroups"] = []): Workout => ({ id: "work", ownerId: "user", name: "Teste", title: "Teste", muscleGroups: [], exercises: items, exerciseGroups, active: true });

test("séries normais mantêm prescrição legada", () => {
  const item = exercise(byId("series-normais"));
  const sets = createTrainingSets(item, workout([item]));
  assert.equal(sets.length, 2);
  assert.ok(sets.every((set) => set.methodEngine === "normal" && set.setRole === "working"));
});

test("drop-set registra todas as etapas e volume real de 1595 kg", () => {
  const item = exercise(byId("drop-set"));
  item.sets = 1;
  item.methodConfig = createMethodConfig(item.methodSnapshot!, { sets: 1, drops: 2, reductionPercent: 20 });
  const stages = createTrainingSets(item, workout([item]));
  assert.deepEqual(stages.map((set) => set.setRole), ["working", "drop", "drop"]);
  const actual = [[80, 10], [55, 9], [30, 10]];
  const volume = stages.reduce((sum, set, index) => sum + actual[index][0] * actual[index][1], 0);
  assert.equal(volume, 1595);
});

test("rest-pause, cluster e myo-reps geram blocos detalhados", () => {
  for (const [id, count, role] of [["rest-pause", 6, "pause"], ["cluster-set", 8, "cluster"], ["myo-reps", 5, "pause"]] as const) {
    const item = exercise(byId(id));
    const stages = createTrainingSets(item, workout([item]));
    assert.equal(stages.length, count);
    assert.ok(stages.some((set) => set.setRole === role));
  }
});

test("progressão, top/back-off e tempo usam o motor configurado", () => {
  const progression = exercise(byId("piramide-crescente"));
  const progressionSets = createTrainingSets(progression, workout([progression]));
  assert.ok(progressionSets.at(-1)!.load > progressionSets[0].load);
  const top = exercise(byId("top-backoff"));
  assert.deepEqual(createTrainingSets(top, workout([top])).map((set) => set.setRole), ["working", "backoff", "backoff", "backoff"]);
  const tempo = exercise(byId("tempo-controlado"));
  assert.deepEqual(createTrainingSets(tempo, workout([tempo]))[0].tempo, { eccentric: 3, pause: 1, concentric: 1, top: 0 });
});

test("AMRAP e isometria geram campos específicos", () => {
  const amrap = exercise(byId("amrap"));
  assert.ok(createTrainingSets(amrap, workout([amrap])).every((set) => set.toFailure));
  const isometric = exercise(byId("isometria"));
  assert.ok(createTrainingSets(isometric, workout([isometric])).every((set) => set.durationSeconds === 30 && set.setRole === "isometric"));
});

test("grupo só descansa após o último membro", () => {
  const method = byId("bi-set");
  const first = { ...exercise(method, "a"), groupId: "g", groupPosition: 0 };
  const second = { ...exercise(method, "b"), groupId: "g", groupPosition: 1 };
  const group = { id: "g", name: "Bi-set", order: 1, exerciseIds: ["a", "b"], methodSnapshot: snapshotMethod(method), methodConfig: createMethodConfig(method, { restBetweenExercises: 0, restAfterRound: 120 }) };
  const plan = workout([first, second], [group]);
  assert.equal(createTrainingSets(first, plan).at(-1)!.restAfterSeconds, 0);
  assert.equal(createTrainingSets(second, plan).at(-1)!.restAfterSeconds, 120);
});

test("snapshot preserva nome e execução após renomear ou desativar catálogo", () => {
  const original = byId("drop-set");
  const item = exercise(original);
  const changed = { ...original, name: "Novo nome", active: false, version: 2 };
  assert.equal(item.methodSnapshot!.name, "Drop-set");
  assert.equal(createTrainingSets(item, workout([item]))[0].methodVersion, 1);
  assert.equal(changed.active, false);
});

test("métodos personalizados podem criar quad-set e drop configurável", () => {
  const quad: TrainingMethod = { ...byId("giant-set"), id: "quad-custom", name: "Quad-set", system: false, exerciseRules: { minExercises: 4, maxExercises: 4 } };
  assert.equal(quad.exerciseRules.maxExercises, 4);
  const customDrop: TrainingMethod = { ...byId("drop-set"), id: "drop-custom", system: false, defaults: { ...byId("drop-set").defaults, drops: 3 } };
  const item = exercise(customDrop);
  item.sets = 1;
  item.methodConfig = createMethodConfig(customDrop, { sets: 1, drops: 3 });
  assert.equal(createTrainingSets(item, workout([item])).length, 4);
});

test("aquecimento e aproximação são preservados, mas não contam como séries efetivas", () => {
  for (const id of ["aquecimento", "rampa"]) {
    const item = exercise(byId(id));
    assert.ok(createTrainingSets(item, workout([item])).every((set) => !isWorkingSet(set)));
  }
});
