import type { SubstanceReference, SubstanceReferenceRiskTag } from "@/types";

export const RISK_TAG_LABELS: Record<SubstanceReferenceRiskTag, string> = {
  cardiovascular: "Cardiovascular",
  hepatic: "Hepático",
  renal: "Renal",
  endocrine: "Endócrino",
  psychiatric: "Psiquiátrico",
  dermatologic: "Dermatológico",
  allergic: "Alérgico",
  metabolic: "Metabólico",
  hematologic: "Hematológico",
  "unknown-long-term": "Efeitos a longo prazo pouco conhecidos",
};

export interface RiskOverlap {
  tag: SubstanceReferenceRiskTag;
  count: number;
  substanceIds: string[];
}

// Somente conta e agrupa categorias de risco compartilhadas entre as substâncias informadas.
// Não classifica combinações como seguras/inseguras nem recomenda uso conjunto.
export function analyzeSubstanceReferenceOverlap(substances: SubstanceReference[]): RiskOverlap[] {
  const byTag = new Map<SubstanceReferenceRiskTag, string[]>();
  for (const substance of substances) {
    for (const tag of substance.riskTags) byTag.set(tag, [...(byTag.get(tag) ?? []), substance.id]);
  }
  return [...byTag.entries()]
    .map(([tag, substanceIds]) => ({ tag, count: substanceIds.length, substanceIds }))
    .filter((item) => item.count > 1)
    .sort((a, b) => b.count - a.count);
}
