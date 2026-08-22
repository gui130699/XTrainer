import assert from "node:assert/strict";
import { test } from "node:test";
import { nextRestAlertKey, shouldEmitCountdownTick } from "../src/lib/training-alerts";

test("alerta final dispara uma única vez por restEndsAt", () => {
  const first = nextRestAlertKey(null, 0, 1000);
  assert.equal(first.shouldAlert, true);
  const second = nextRestAlertKey(first.nextKey, 0, 1000);
  assert.equal(second.shouldAlert, false);
});

test("novo restEndsAt dispara um novo alerta", () => {
  const first = nextRestAlertKey(null, 0, 1000);
  const second = nextRestAlertKey(first.nextKey, 0, 2000);
  assert.equal(second.shouldAlert, true);
  assert.equal(second.nextKey, "2000");
});

test("não dispara enquanto o descanso ainda não chegou a zero", () => {
  assert.equal(nextRestAlertKey(null, 5, 1000).shouldAlert, false);
  assert.equal(nextRestAlertKey(null, 0, null).shouldAlert, false);
});

test("aviso dos últimos segundos dispara uma vez por segundo dentro da janela", () => {
  assert.equal(shouldEmitCountdownTick(null, 3), true);
  assert.equal(shouldEmitCountdownTick(3, 3), false);
  assert.equal(shouldEmitCountdownTick(3, 2), true);
  assert.equal(shouldEmitCountdownTick(null, 5), false);
  assert.equal(shouldEmitCountdownTick(null, 0), false);
});
