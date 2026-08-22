import assert from "node:assert/strict";
import { test } from "node:test";
import { authSchemasByMode, workoutExerciseIssue, workoutFormSchema } from "../src/lib/validation";

test("login exige e-mail válido e senha com pelo menos 6 caracteres", () => {
  assert.equal(authSchemasByMode.login.safeParse({ email: "not-an-email", password: "123456" }).success, false);
  assert.equal(authSchemasByMode.login.safeParse({ email: "a@b.com", password: "12345" }).success, false);
  assert.equal(authSchemasByMode.login.safeParse({ email: "a@b.com", password: "123456" }).success, true);
});

test("reset só exige e-mail", () => {
  assert.equal(authSchemasByMode.reset.safeParse({ email: "a@b.com" }).success, true);
  assert.equal(authSchemasByMode.reset.safeParse({ email: "" }).success, false);
});

test("register exige nome, e-mail, senha e confirmação igual", () => {
  const base = { name: "Guilherme", email: "a@b.com", password: "123456" };
  assert.equal(authSchemasByMode.register.safeParse({ ...base, confirm: "123456" }).success, true);
  assert.equal(authSchemasByMode.register.safeParse({ ...base, confirm: "different" }).success, false);
  assert.equal(authSchemasByMode.register.safeParse({ ...base, name: "", confirm: "123456" }).success, false);
});

test("workoutExerciseIssue aceita um exercício válido", () => {
  assert.equal(workoutExerciseIssue({ name: "Supino", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 }), null);
});

test("workoutExerciseIssue rejeita séries menores que 1", () => {
  const issue = workoutExerciseIssue({ name: "Supino", sets: 0, repsMin: 8, repsMax: 12, restSeconds: 90 });
  assert.match(issue ?? "", /Supino/);
  assert.match(issue ?? "", /Séries/);
});

test("workoutExerciseIssue rejeita repetições máximas menores que as mínimas", () => {
  const issue = workoutExerciseIssue({ name: "Agachamento", sets: 3, repsMin: 12, repsMax: 8, restSeconds: 60 });
  assert.match(issue ?? "", /Agachamento/);
  assert.match(issue ?? "", /maior ou igual/);
});

test("workoutExerciseIssue rejeita descanso negativo", () => {
  const issue = workoutExerciseIssue({ name: "Remada", sets: 3, repsMin: 8, repsMax: 12, restSeconds: -5 });
  assert.match(issue ?? "", /Descanso/);
});

test("workoutFormSchema exige nome, título e ao menos um exercício", () => {
  const validExercise = { name: "Supino", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 };
  assert.equal(workoutFormSchema.safeParse({ name: "Treino A", title: "Peito", exercises: [validExercise] }).success, true);
  assert.equal(workoutFormSchema.safeParse({ name: "", title: "Peito", exercises: [validExercise] }).success, false);
  assert.equal(workoutFormSchema.safeParse({ name: "Treino A", title: "", exercises: [validExercise] }).success, false);
  assert.equal(workoutFormSchema.safeParse({ name: "Treino A", title: "Peito", exercises: [] }).success, false);
});
