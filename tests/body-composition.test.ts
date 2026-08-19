import assert from "node:assert/strict";
import test from "node:test";
import {
  ageOnDate,
  calculateBodyComposition,
  formatAssessmentProtocol,
  parseAssessmentProtocol,
} from "../src/lib/body-assessments";

test("Jackson-Pollock de 3 dobras calcula a composição corporal masculina", () => {
  const result = calculateBodyComposition({
    age: 30,
    sex: "male",
    weight: 80,
    protocol: "3-folds",
    skinfolds: { chest: 10, abdominal: 20, thigh: 15 },
  });

  assert.equal(result.skinfoldSum, 45);
  assert.equal(result.bodyDensity, 1.0677);
  assert.equal(result.bodyFat, 13.6);
  assert.equal(result.fatMass, 10.9);
  assert.equal(result.leanMass, 69.1);
  assert.equal(result.fatMass + result.leanMass, 80);
});

test("Jackson-Pollock de 3 dobras usa os pontos femininos corretos", () => {
  const result = calculateBodyComposition({
    age: 28,
    sex: "female",
    weight: 65,
    protocol: "3-folds",
    skinfolds: { triceps: 20, suprailiac: 18, thigh: 22 },
  });

  assert.equal(result.skinfoldSum, 60);
  assert.equal(result.bodyFat, 24);
  assert.equal(result.fatMass, 15.6);
  assert.equal(result.leanMass, 49.4);
});

test("protocolo de 7 dobras exige todos os sete pontos", () => {
  assert.throws(() => calculateBodyComposition({
    age: 35,
    sex: "male",
    weight: 80,
    protocol: "7-folds",
    skinfolds: { chest: 10, abdominal: 20, thigh: 15 },
  }), /axilar média.*tríceps.*subescapular.*supra-ilíaca/);
});

test("protocolo registra e recupera sexo e idade usados no cálculo", () => {
  const protocol = formatAssessmentProtocol("7-folds", "female", 34);
  assert.equal(protocol, "Jackson-Pollock 7 dobras + Siri | female | 34");
  assert.deepEqual(parseAssessmentProtocol(protocol), { protocol: "7-folds", sex: "female", age: 34 });
});

test("idade é calculada na data exata da avaliação", () => {
  assert.equal(ageOnDate("1990-08-20", "2026-08-19"), 35);
  assert.equal(ageOnDate("1990-08-19", "2026-08-19"), 36);
});
