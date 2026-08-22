import assert from "node:assert/strict";
import { test } from "node:test";
import { dataErrorMessage, formatDateBR, normalizeSearchText, parseBrazilianNumber, slugifyExerciseName } from "../src/lib/utils";

test("normalizeSearchText remove acentos, caixa e espaços extras", () => {
  assert.equal(normalizeSearchText("  Agachamento LIVRE  "), "agachamento livre");
  assert.equal(normalizeSearchText("Supinó Reto"), "supino reto");
  assert.equal(normalizeSearchText("Tríceps   Corda"), "triceps corda");
});

test("slugifyExerciseName gera um slug seguro para URLs", () => {
  assert.equal(slugifyExerciseName("Supino Reto com Barra"), "supino-reto-com-barra");
  assert.equal(slugifyExerciseName("  Rosca Direta!!  "), "rosca-direta");
});

test("parseBrazilianNumber aceita vírgula como separador decimal", () => {
  assert.equal(parseBrazilianNumber("12,5"), 12.5);
  assert.equal(parseBrazilianNumber("100"), 100);
  assert.ok(Number.isNaN(parseBrazilianNumber("abc")));
});

test("formatDateBR converte ISO (yyyy-mm-dd) para dd/mm/yyyy", () => {
  assert.equal(formatDateBR("2026-08-22"), "22/08/2026");
  assert.equal(formatDateBR("not-a-date"), "not-a-date");
});

test("dataErrorMessage traduz códigos de erro do Firestore/Firebase conhecidos", () => {
  assert.equal(dataErrorMessage({ code: "permission-denied" }), "Sua conta não possui permissão para esta operação.");
  assert.equal(dataErrorMessage({ code: "firestore/unauthenticated" }), "Sua sessão expirou. Entre novamente.");
  assert.equal(dataErrorMessage({ code: "unavailable" }), "Sem conexão com o servidor. Verifique sua internet e tente novamente.");
  assert.equal(dataErrorMessage({ code: "resource-exhausted" }), "O serviço está temporariamente ocupado. Aguarde e tente novamente.");
});

test("dataErrorMessage cai no fallback para erros desconhecidos ou internos do Firebase", () => {
  assert.equal(dataErrorMessage(new Error("Firebase: something internal")), "Não foi possível concluir esta operação.");
  assert.equal(dataErrorMessage(new Error("Custom fallback"), "fallback"), "Custom fallback");
  assert.equal(dataErrorMessage("string qualquer", "fallback"), "fallback");
});
