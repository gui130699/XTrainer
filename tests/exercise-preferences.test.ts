import assert from "node:assert/strict";
import { test } from "node:test";
import { addAlternative, moveAlternative, removeAlternative } from "../src/lib/exercise-preferences";

test("não permite o próprio exercício como alternativa dele mesmo", () => {
  assert.deepEqual(addAlternative([], "supino-reto", "supino-reto"), []);
});

test("não permite alternativas duplicadas", () => {
  const once = addAlternative([], "supino-reto", "supino-maquina");
  assert.deepEqual(addAlternative(once, "supino-reto", "supino-maquina"), once);
});

test("adiciona ao final, preservando a ordem existente", () => {
  const first = addAlternative([], "supino-reto", "a");
  const second = addAlternative(first, "supino-reto", "b");
  assert.deepEqual(second, ["a", "b"]);
});

test("remove sem afetar a ordem dos demais", () => {
  assert.deepEqual(removeAlternative(["a", "b", "c"], "b"), ["a", "c"]);
});

test("move para cima/baixo dentro dos limites da lista", () => {
  assert.deepEqual(moveAlternative(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moveAlternative(["a", "b", "c"], "b", 1), ["a", "c", "b"]);
  assert.deepEqual(moveAlternative(["a", "b", "c"], "a", -1), ["a", "b", "c"]);
  assert.deepEqual(moveAlternative(["a", "b", "c"], "c", 1), ["a", "b", "c"]);
});
