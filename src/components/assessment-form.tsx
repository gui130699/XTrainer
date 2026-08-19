"use client";

import { Button } from "@/components/ui";
import {
  ageOnDate,
  calculateBodyComposition,
  formatAssessmentProtocol,
  parseAssessmentProtocol,
  SKINFOLD_PROTOCOL_SITES,
  type BodyCompositionResult,
  type BodyCompositionSex,
  type SkinfoldProtocol,
} from "@/lib/body-assessments";
import { parseBrazilianNumber } from "@/lib/utils";
import type { AssessmentPhotoView, AssessmentType, BodyMeasurements, PhysicalAssessment, Skinfolds } from "@/types";
import { Save, X } from "lucide-react";
import { useState } from "react";

export interface AssessmentFormValue {
  date: string;
  type: AssessmentType;
  weight?: number;
  height?: number;
  bodyFat?: number;
  fatMass?: number;
  leanMass?: number;
  measurements: BodyMeasurements;
  skinfolds?: Skinfolds;
  assessmentProtocol?: string;
  notes?: string;
}

const measurementGroups: ReadonlyArray<readonly [string, ReadonlyArray<readonly [keyof BodyMeasurements, string]>]> = [
  ["Dados superiores", [["neck", "Pescoço"], ["shoulders", "Ombros"], ["chest", "Peitoral"], ["armRightRelaxed", "Braço direito relaxado"], ["armLeftRelaxed", "Braço esquerdo relaxado"], ["armRightFlexed", "Braço direito contraído"], ["armLeftFlexed", "Braço esquerdo contraído"], ["forearmRight", "Antebraço direito"], ["forearmLeft", "Antebraço esquerdo"]]],
  ["Tronco e membros inferiores", [["waist", "Cintura"], ["abdomen", "Abdômen"], ["hip", "Quadril"], ["thighRight", "Coxa direita"], ["thighLeft", "Coxa esquerda"], ["calfRight", "Panturrilha direita"], ["calfLeft", "Panturrilha esquerda"]]],
] as const;

const skinfoldFields: ReadonlyArray<readonly [keyof Skinfolds, string]> = [["triceps", "Tríceps"], ["biceps", "Bíceps"], ["subscapular", "Subescapular"], ["suprailiac", "Supra-ilíaca"], ["abdominal", "Abdominal"], ["chest", "Peitoral"], ["midaxillary", "Axilar média"], ["thigh", "Coxa"], ["calf", "Panturrilha"]] as const;

const skinfoldLabels = Object.fromEntries(skinfoldFields) as Record<keyof Skinfolds, string>;

function optionalNumber(form: FormData, key: string) {
  const raw = String(form.get(key) ?? "").trim();
  if (!raw) return undefined;
  const value = parseBrazilianNumber(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Valor inválido em ${key}.`);
  return value;
}

function readSkinfolds(form: FormData) {
  const skinfolds: Skinfolds = {};
  for (const [key] of skinfoldFields) {
    const value = optionalNumber(form, `skinfold.${key}`);
    if (value !== undefined) skinfolds[key] = value;
  }
  return skinfolds;
}

function calculateFromForm(form: FormData) {
  const weight = optionalNumber(form, "weight");
  const age = optionalNumber(form, "age");
  const sex = String(form.get("biologicalSex")) as BodyCompositionSex;
  const protocol = String(form.get("assessmentProtocol")) as SkinfoldProtocol;
  if (weight === undefined || age === undefined || !["male", "female"].includes(sex) || !["3-folds", "7-folds"].includes(protocol)) return null;
  return calculateBodyComposition({ weight, age, sex, protocol, skinfolds: readSkinfolds(form) });
}

export function AssessmentForm({ mode, initial, saving, profileBirthDate, profileHeight, profileSex, onSave, onCancel }: {
  mode: AssessmentType;
  initial?: PhysicalAssessment | null;
  saving: boolean;
  profileBirthDate?: string;
  profileHeight?: number;
  profileSex?: string;
  onSave: (value: AssessmentFormValue, files: Partial<Record<AssessmentPhotoView, File>>, alsoWeight: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const parsedProtocol = parseAssessmentProtocol(initial?.assessmentProtocol);
  const initialDate = initial?.date ?? new Date().toISOString().slice(0, 10);
  const defaultSex: BodyCompositionSex | "" = parsedProtocol?.sex ?? (profileSex === "male" || profileSex === "female" ? profileSex : "");
  const defaultProtocol: SkinfoldProtocol = parsedProtocol?.protocol ?? "7-folds";
  const defaultAge = parsedProtocol?.age ?? ageOnDate(profileBirthDate, initialDate);
  const [protocol, setProtocol] = useState<SkinfoldProtocol>(defaultProtocol);
  const [calculation, setCalculation] = useState<BodyCompositionResult | null>(() => {
    if (mode !== "advanced" || !initial?.weight || !defaultAge || !defaultSex || !initial.skinfolds) return null;
    try {
      return calculateBodyComposition({ weight: initial.weight, age: defaultAge, sex: defaultSex, protocol: defaultProtocol, skinfolds: initial.skinfolds });
    } catch {
      return null;
    }
  });
  const [formError, setFormError] = useState("");
  const [selectedSex, setSelectedSex] = useState<BodyCompositionSex | "">(defaultSex);
  const requiredSites = selectedSex ? new Set(SKINFOLD_PROTOCOL_SITES[selectedSex][protocol]) : new Set<keyof Skinfolds>();

  function refreshCalculation(formElement: HTMLFormElement) {
    if (mode !== "advanced") return;
    const form = new FormData(formElement);
    setSelectedSex(String(form.get("biologicalSex")) as BodyCompositionSex | "");
    setProtocol(String(form.get("assessmentProtocol")) as SkinfoldProtocol);
    try {
      setCalculation(calculateFromForm(form));
      setFormError("");
    } catch {
      setCalculation(null);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const form = new FormData(event.currentTarget);
    try {
      const measurements: BodyMeasurements = {};
      for (const [, fields] of measurementGroups) for (const [key] of fields) {
        const value = optionalNumber(form, `measurement.${key}`);
        if (value !== undefined) measurements[key] = value;
      }
      const skinfolds = mode === "advanced" ? readSkinfolds(form) : undefined;
      const files: Partial<Record<AssessmentPhotoView, File>> = {};
      for (const view of ["front", "side", "back"] as AssessmentPhotoView[]) {
        const file = form.get(`photo.${view}`);
        if (file instanceof File && file.size) files[view] = file;
      }

      const composition = mode === "advanced" ? calculateFromForm(form) : null;
      if (mode === "advanced" && !composition) throw new Error("Informe peso, idade, sexo biológico, protocolo e todas as dobras obrigatórias.");
      const age = composition ? optionalNumber(form, "age")! : undefined;
      const sex = composition ? String(form.get("biologicalSex")) as BodyCompositionSex : undefined;

      await onSave({
        date: String(form.get("date")),
        type: mode,
        weight: optionalNumber(form, "weight"),
        height: optionalNumber(form, "height"),
        bodyFat: composition?.bodyFat ?? optionalNumber(form, "bodyFat"),
        fatMass: composition?.fatMass ?? optionalNumber(form, "fatMass"),
        leanMass: composition?.leanMass ?? optionalNumber(form, "leanMass"),
        measurements,
        skinfolds: skinfolds && Object.keys(skinfolds).length ? skinfolds : undefined,
        assessmentProtocol: composition && sex && age !== undefined ? formatAssessmentProtocol(composition.protocol, sex, age) : undefined,
        notes: String(form.get("notes") ?? "").trim() || undefined,
      }, files, form.get("alsoWeight") === "on");
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Confira os dados da avaliação.");
    }
  }

  const showMeasurements = mode !== "quick";
  return <form className="assessment-form" onSubmit={submit} onInput={(event) => refreshCalculation(event.currentTarget)}>
    <details open><summary>Dados gerais</summary><div className="form-grid">
      <label>Data<input required name="date" type="date" defaultValue={initialDate}/></label>
      <label>Peso (kg)<input required={mode === "advanced"} name="weight" inputMode="decimal" defaultValue={initial?.weight}/></label>
      <label>Altura (cm)<input name="height" inputMode="decimal" defaultValue={initial?.height ?? profileHeight}/></label>
      {mode === "advanced" && <>
        <label>Sexo biológico<select required name="biologicalSex" defaultValue={defaultSex}><option value="">Selecione</option><option value="female">Feminino</option><option value="male">Masculino</option></select></label>
        <label>Idade na avaliação<input required name="age" type="number" min="18" max="100" step="1" defaultValue={defaultAge}/></label>
        <label>Protocolo<select name="assessmentProtocol" value={protocol} onChange={(event) => setProtocol(event.target.value as SkinfoldProtocol)}><option value="3-folds">Jackson–Pollock — 3 dobras</option><option value="7-folds">Jackson–Pollock — 7 dobras</option></select></label>
      </>}
      {mode !== "advanced" && <>
        <label>Gordura corporal (%)<input name="bodyFat" inputMode="decimal" defaultValue={initial?.bodyFat}/></label>
        <label>Massa gorda (kg)<input name="fatMass" inputMode="decimal" defaultValue={initial?.fatMass}/></label>
        <label>Massa magra (kg)<input name="leanMass" inputMode="decimal" defaultValue={initial?.leanMass}/></label>
      </>}
    </div><label className="check-label"><input name="alsoWeight" type="checkbox"/> Registrar este peso também no histórico oficial</label></details>

    {showMeasurements && measurementGroups.map(([title, fields]) => <details key={title}><summary>{title}</summary><div className="form-grid">{fields.map(([key, label]) => <label key={key}>{label} (cm)<input name={`measurement.${key}`} inputMode="decimal" defaultValue={initial?.measurements?.[key]}/></label>)}</div></details>)}

    {mode === "advanced" && <>
      <details open><summary>Dobras cutâneas para o cálculo</summary><p className="muted">Meça com adipômetro e informe em milímetros. Os campos marcados com * são exigidos pelo protocolo selecionado.</p><div className="form-grid">{skinfoldFields.map(([key, label]) => <label key={key}>{label}{requiredSites.has(key) ? " *" : ""} (mm)<input required={requiredSites.has(key)} name={`skinfold.${key}`} inputMode="decimal" min="0.1" max="100" step="0.1" defaultValue={initial?.skinfolds?.[key]}/></label>)}</div></details>
      <section className="composition-result" aria-live="polite"><div><span>Gordura corporal</span><strong>{calculation ? `${calculation.bodyFat.toLocaleString("pt-BR")}%` : "—"}</strong></div><div><span>Massa gorda</span><strong>{calculation ? `${calculation.fatMass.toLocaleString("pt-BR")} kg` : "—"}</strong></div><div><span>Massa magra</span><strong>{calculation ? `${calculation.leanMass.toLocaleString("pt-BR")} kg` : "—"}</strong></div><p>{calculation ? `Calculado pela soma de ${calculation.skinfoldSum.toLocaleString("pt-BR")} mm, densidade corporal ${calculation.bodyDensity.toLocaleString("pt-BR")} e equação de Siri.` : "Preencha os dados obrigatórios para calcular automaticamente."}</p></section>
      <details><summary>Fotos</summary><p className="muted">As fotos são opcionais e privadas.</p><div className="form-grid"><label>Foto de frente<input name="photo.front" type="file" accept="image/*"/></label><label>Foto lateral<input name="photo.side" type="file" accept="image/*"/></label><label>Foto de costas<input name="photo.back" type="file" accept="image/*"/></label></div></details>
    </>}

    <details open><summary>Observações</summary><label>Observações<textarea name="notes" defaultValue={initial?.notes}/></label></details>
    {formError && <p className="form-error" role="alert">{formError}</p>}
    <p className="muted">A composição corporal é uma estimativa antropométrica e depende da técnica e precisão das medidas. Não substitui avaliação clínica.</p>
    <div className="assessment-form-actions"><Button className="assessment-save-button" disabled={saving}><Save size={17}/>{saving ? "SALVANDO..." : initial ? "ATUALIZAR AVALIAÇÃO" : "SALVAR AVALIAÇÃO"}</Button><button type="button" className="assessment-cancel-button" onClick={onCancel} disabled={saving}><X size={17}/> CANCELAR</button></div>
  </form>;
}

export const BODY_MEASUREMENT_LABELS = Object.fromEntries(measurementGroups.flatMap(([, fields]) => fields)) as Record<string, string>;
export const SKINFOLD_LABELS = skinfoldLabels as Record<string, string>;
