import type { PhysicalAssessment } from "@/types";

export interface AssessmentComparisonRow {
  key: string;
  label: string;
  unit: "kg" | "%" | "cm" | "mm";
  before: number;
  after: number;
  difference: number;
}

const generalFields = [
  ["weight", "Peso", "kg"],
  ["bodyFat", "Gordura corporal", "%"],
  ["fatMass", "Massa gorda", "kg"],
  ["leanMass", "Massa magra", "kg"],
] as const;

const measurementLabels: Record<string, string> = {
  neck: "Pescoço", shoulders: "Ombros", chest: "Peitoral", armRightRelaxed: "Braço direito relaxado",
  armLeftRelaxed: "Braço esquerdo relaxado", armRightFlexed: "Braço direito contraído", armLeftFlexed: "Braço esquerdo contraído",
  forearmRight: "Antebraço direito", forearmLeft: "Antebraço esquerdo", waist: "Cintura", abdomen: "Abdômen",
  hip: "Quadril", thighRight: "Coxa direita", thighLeft: "Coxa esquerda", calfRight: "Panturrilha direita", calfLeft: "Panturrilha esquerda",
};

const skinfoldLabels: Record<string, string> = {
  triceps: "Tríceps", biceps: "Bíceps", subscapular: "Subescapular", suprailiac: "Supra-ilíaca",
  abdominal: "Abdominal", chest: "Peitoral", midaxillary: "Axilar média", thigh: "Coxa", calf: "Panturrilha",
};

export function compareAssessments(before: PhysicalAssessment, after: PhysicalAssessment) {
  const rows: AssessmentComparisonRow[] = [];
  for (const [key, label, unit] of generalFields) {
    const oldValue = before[key];
    const newValue = after[key];
    if (typeof oldValue === "number" && typeof newValue === "number") rows.push({ key, label, unit, before: oldValue, after: newValue, difference: newValue - oldValue });
  }
  for (const [key, label] of Object.entries(measurementLabels)) {
    const oldValue = before.measurements[key];
    const newValue = after.measurements[key];
    if (typeof oldValue === "number" && typeof newValue === "number") rows.push({ key: `measurement.${key}`, label, unit: "cm", before: oldValue, after: newValue, difference: newValue - oldValue });
  }
  for (const [key, label] of Object.entries(skinfoldLabels)) {
    const oldValue = before.skinfolds?.[key];
    const newValue = after.skinfolds?.[key];
    if (typeof oldValue === "number" && typeof newValue === "number") rows.push({ key: `skinfold.${key}`, label, unit: "mm", before: oldValue, after: newValue, difference: newValue - oldValue });
  }
  return rows;
}
