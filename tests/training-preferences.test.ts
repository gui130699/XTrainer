import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TRAINING_PREFERENCES, parseTrainingPreferences } from "../src/hooks/use-training-preferences";

test("retorna os padrões quando não há valor salvo", () => {
  assert.deepEqual(parseTrainingPreferences(null), DEFAULT_TRAINING_PREFERENCES);
});

test("retorna os padrões para JSON inválido, sem quebrar", () => {
  assert.deepEqual(parseTrainingPreferences("{not valid json"), DEFAULT_TRAINING_PREFERENCES);
  assert.deepEqual(parseTrainingPreferences("42"), DEFAULT_TRAINING_PREFERENCES);
  assert.deepEqual(parseTrainingPreferences("null"), DEFAULT_TRAINING_PREFERENCES);
});

test("mescla valores parciais válidos com os padrões", () => {
  assert.deepEqual(parseTrainingPreferences(JSON.stringify({ soundEnabled: false })), { ...DEFAULT_TRAINING_PREFERENCES, soundEnabled: false });
  assert.deepEqual(parseTrainingPreferences(JSON.stringify({ soundEnabled: "yes", vibrationEnabled: false })), { ...DEFAULT_TRAINING_PREFERENCES, vibrationEnabled: false });
});
