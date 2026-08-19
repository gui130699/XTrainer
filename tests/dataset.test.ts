import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_EXERCISES } from "../src/data/default-exercises";

test("dataset canônico mantém 202 IDs, nomes e ordens únicos", () => {
  assert.equal(DEFAULT_EXERCISES.length, 202);
  assert.equal(new Set(DEFAULT_EXERCISES.map((item) => item.id)).size, 202);
  assert.equal(new Set(DEFAULT_EXERCISES.map((item) => item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim())).size, 202);
  assert.deepEqual(DEFAULT_EXERCISES.map((item) => item.sortOrder).sort((a, b) => a - b), Array.from({ length: 202 }, (_, index) => index + 1));
  assert.ok(DEFAULT_EXERCISES.every((item) => item.videoUrl.startsWith("https://") && item.muscleGroup));
});
