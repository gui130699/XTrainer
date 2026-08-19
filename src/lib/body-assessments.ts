import type { PhysicalAssessment, Skinfolds } from "@/types";

export type BodyCompositionSex = "male" | "female";
export type SkinfoldProtocol = "3-folds" | "7-folds";

export interface BodyCompositionInput {
  age: number;
  sex: BodyCompositionSex;
  weight: number;
  protocol: SkinfoldProtocol;
  skinfolds: Skinfolds;
}

export interface BodyCompositionResult {
  bodyDensity: number;
  bodyFat: number;
  fatMass: number;
  leanMass: number;
  skinfoldSum: number;
  protocol: SkinfoldProtocol;
}

export const SKINFOLD_PROTOCOL_SITES: Record<BodyCompositionSex, Record<SkinfoldProtocol, (keyof Skinfolds)[]>> = {
  male: {
    "3-folds": ["chest", "abdominal", "thigh"],
    "7-folds": ["chest", "midaxillary", "triceps", "subscapular", "abdominal", "suprailiac", "thigh"],
  },
  female: {
    "3-folds": ["triceps", "suprailiac", "thigh"],
    "7-folds": ["chest", "midaxillary", "triceps", "subscapular", "abdominal", "suprailiac", "thigh"],
  },
};

const protocolLabels: Record<SkinfoldProtocol, string> = {
  "3-folds": "Jackson-Pollock 3 dobras + Siri",
  "7-folds": "Jackson-Pollock 7 dobras + Siri",
};

const skinfoldInputLabels: Record<string, string> = {
  chest: "peitoral",
  midaxillary: "axilar média",
  triceps: "tríceps",
  subscapular: "subescapular",
  abdominal: "abdominal",
  suprailiac: "supra-ilíaca",
  thigh: "coxa",
};

const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

export function calculateBodyComposition({ age, sex, weight, protocol, skinfolds }: BodyCompositionInput): BodyCompositionResult {
  if (!Number.isFinite(weight) || weight <= 0 || weight > 500) throw new Error("Informe um peso válido entre 1 e 500 kg.");
  if (!Number.isInteger(age) || age < 18 || age > 100) throw new Error("Informe uma idade válida, em anos completos, a partir de 18 anos.");
  if (sex !== "male" && sex !== "female") throw new Error("Selecione o sexo biológico usado pelo protocolo.");
  if (protocol !== "3-folds" && protocol !== "7-folds") throw new Error("Selecione um protocolo Jackson-Pollock válido.");

  const sites = SKINFOLD_PROTOCOL_SITES[sex][protocol];
  const invalidSites = sites.filter((site) => {
    const value = skinfolds[site];
    return typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 100;
  });
  if (invalidSites.length) {
    throw new Error(`Confira as dobras obrigatórias: ${invalidSites.map((site) => skinfoldInputLabels[String(site)]).join(", ")}. Use valores entre 0,1 e 100 mm.`);
  }

  const values = sites.map((site) => skinfolds[site]);
  const skinfoldSum = (values as number[]).reduce((sum, value) => sum + value, 0);
  const squaredSum = skinfoldSum * skinfoldSum;
  let bodyDensity: number;

  if (sex === "male" && protocol === "3-folds") {
    bodyDensity = 1.10938 - 0.0008267 * skinfoldSum + 0.0000016 * squaredSum - 0.0002574 * age;
  } else if (sex === "female" && protocol === "3-folds") {
    bodyDensity = 1.0994921 - 0.0009929 * skinfoldSum + 0.0000023 * squaredSum - 0.0001392 * age;
  } else if (sex === "male") {
    bodyDensity = 1.112 - 0.00043499 * skinfoldSum + 0.00000055 * squaredSum - 0.00028826 * age;
  } else {
    bodyDensity = 1.097 - 0.00046971 * skinfoldSum + 0.00000056 * squaredSum - 0.00012828 * age;
  }

  const bodyFat = 495 / bodyDensity - 450;
  if (!Number.isFinite(bodyFat) || bodyFat <= 0 || bodyFat >= 75) {
    throw new Error("As medidas informadas geraram um resultado fora da faixa válida. Confira as dobras, o sexo e a idade.");
  }

  const fatMass = weight * bodyFat / 100;
  return {
    bodyDensity: round(bodyDensity, 5),
    bodyFat: round(bodyFat, 1),
    fatMass: round(fatMass, 1),
    leanMass: round(weight - fatMass, 1),
    skinfoldSum: round(skinfoldSum, 1),
    protocol,
  };
}

export function formatAssessmentProtocol(protocol: SkinfoldProtocol, sex: BodyCompositionSex, age: number) {
  return `${protocolLabels[protocol]} | ${sex} | ${age}`;
}

export function parseAssessmentProtocol(value?: string) {
  if (!value) return null;
  const match = value.match(/^Jackson-Pollock ([37]) dobras \+ Siri \| (male|female) \| (\d{2,3})$/);
  if (!match) return null;
  return {
    protocol: `${match[1]}-folds` as SkinfoldProtocol,
    sex: match[2] as BodyCompositionSex,
    age: Number(match[3]),
  };
}

export function ageOnDate(birthDate?: string, assessmentDate?: string) {
  if (!birthDate || !assessmentDate) return undefined;
  const birth = new Date(`${birthDate}T12:00:00`);
  const assessment = new Date(`${assessmentDate}T12:00:00`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(assessment.getTime()) || assessment < birth) return undefined;
  let age = assessment.getFullYear() - birth.getFullYear();
  const beforeBirthday = assessment.getMonth() < birth.getMonth()
    || (assessment.getMonth() === birth.getMonth() && assessment.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

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
