import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeSubstanceReferenceOverlap } from "../src/lib/substance-analysis";
import type { SubstanceReference } from "../src/types";

const substance = (overrides: Partial<SubstanceReference>): SubstanceReference => ({
  id: "id",
  name: "Nome",
  description: "Descrição",
  riskTags: [],
  active: true,
  isSystem: false,
  sortOrder: 0,
  ...overrides,
});

test("identifica categorias de risco compartilhadas por mais de uma substância", () => {
  const a = substance({ id: "a", riskTags: ["cardiovascular", "hepatic"] });
  const b = substance({ id: "b", riskTags: ["cardiovascular", "renal"] });
  const overlaps = analyzeSubstanceReferenceOverlap([a, b]);
  assert.deepEqual(overlaps, [{ tag: "cardiovascular", count: 2, substanceIds: ["a", "b"] }]);
});

test("não retorna categorias presentes em apenas uma substância", () => {
  const a = substance({ id: "a", riskTags: ["hepatic"] });
  const b = substance({ id: "b", riskTags: ["renal"] });
  assert.deepEqual(analyzeSubstanceReferenceOverlap([a, b]), []);
});

test("uma única substância nunca produz sobreposição", () => {
  const a = substance({ id: "a", riskTags: ["cardiovascular", "hepatic"] });
  assert.deepEqual(analyzeSubstanceReferenceOverlap([a]), []);
});
