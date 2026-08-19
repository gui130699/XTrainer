"use client";

import { Button } from "@/components/ui";
import { parseBrazilianNumber } from "@/lib/utils";
import type { AssessmentPhotoView, AssessmentType, BodyMeasurements, PhysicalAssessment, Skinfolds } from "@/types";

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

function optionalNumber(form: FormData, key: string) {
  const raw = String(form.get(key) ?? "").trim();
  if (!raw) return undefined;
  const value = parseBrazilianNumber(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Valor inválido em ${key}.`);
  return value;
}

export function AssessmentForm({ mode, initial, saving, onSave, onCancel }: {
  mode: AssessmentType;
  initial?: PhysicalAssessment | null;
  saving: boolean;
  onSave: (value: AssessmentFormValue, files: Partial<Record<AssessmentPhotoView, File>>, alsoWeight: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const measurements: BodyMeasurements = {};
    for (const [, fields] of measurementGroups) for (const [key] of fields) {
      const value = optionalNumber(form, `measurement.${key}`);
      if (value !== undefined) measurements[key] = value;
    }
    const skinfolds: Skinfolds = {};
    if (mode === "advanced") for (const [key] of skinfoldFields) {
      const value = optionalNumber(form, `skinfold.${key}`);
      if (value !== undefined) skinfolds[key] = value;
    }
    const files: Partial<Record<AssessmentPhotoView, File>> = {};
    for (const view of ["front", "side", "back"] as AssessmentPhotoView[]) {
      const file = form.get(`photo.${view}`);
      if (file instanceof File && file.size) files[view] = file;
    }
    await onSave({
      date: String(form.get("date")),
      type: mode,
      weight: optionalNumber(form, "weight"),
      height: optionalNumber(form, "height"),
      bodyFat: optionalNumber(form, "bodyFat"),
      fatMass: optionalNumber(form, "fatMass"),
      leanMass: optionalNumber(form, "leanMass"),
      measurements,
      skinfolds: mode === "advanced" && Object.keys(skinfolds).length ? skinfolds : undefined,
      assessmentProtocol: String(form.get("assessmentProtocol") ?? "").trim() || undefined,
      notes: String(form.get("notes") ?? "").trim() || undefined,
    }, files, form.get("alsoWeight") === "on");
  }

  const showMeasurements = mode !== "quick";
  return <form className="assessment-form" onSubmit={submit}><details open><summary>Dados gerais</summary><div className="form-grid"><label>Data<input required name="date" type="date" defaultValue={initial?.date ?? new Date().toISOString().slice(0, 10)}/></label><label>Peso (kg)<input name="weight" inputMode="decimal" defaultValue={initial?.weight}/></label><label>Altura (cm)<input name="height" inputMode="decimal" defaultValue={initial?.height}/></label><label>Gordura corporal (%)<input name="bodyFat" inputMode="decimal" defaultValue={initial?.bodyFat}/></label><label>Massa gorda (kg)<input name="fatMass" inputMode="decimal" defaultValue={initial?.fatMass}/></label><label>Massa magra (kg)<input name="leanMass" inputMode="decimal" defaultValue={initial?.leanMass}/></label></div><label className="check-label"><input name="alsoWeight" type="checkbox"/> Registrar este peso também no histórico oficial</label></details>
    {showMeasurements && measurementGroups.map(([title, fields]) => <details key={title}><summary>{title}</summary><div className="form-grid">{fields.map(([key, label]) => <label key={key}>{label} (cm)<input name={`measurement.${key}`} inputMode="decimal" defaultValue={initial?.measurements?.[key]}/></label>)}</div></details>)}
    {mode === "advanced" && <><details><summary>Dobras cutâneas</summary><p className="muted">Informe apenas os pontos medidos pelo protocolo profissional, em milímetros.</p><div className="form-grid">{skinfoldFields.map(([key, label]) => <label key={key}>{label} (mm)<input name={`skinfold.${key}`} inputMode="decimal" defaultValue={initial?.skinfolds?.[key]}/></label>)}</div></details><details><summary>Protocolo e fotos</summary><label>Protocolo<select name="assessmentProtocol" defaultValue={initial?.assessmentProtocol ?? "manual"}><option value="manual">Manual</option><option value="3-folds">3 dobras</option><option value="7-folds">7 dobras</option><option value="other">Outro protocolo</option></select></label><p className="muted">O sistema não calcula percentual de gordura automaticamente. Registre o resultado validado pelo profissional.</p><div className="form-grid"><label>Foto de frente<input name="photo.front" type="file" accept="image/*"/></label><label>Foto lateral<input name="photo.side" type="file" accept="image/*"/></label><label>Foto de costas<input name="photo.back" type="file" accept="image/*"/></label></div></details></>}
    <details open><summary>Observações</summary><label>Observações<textarea name="notes" defaultValue={initial?.notes}/></label></details><div className="actions"><Button disabled={saving}>{saving ? "SALVANDO..." : initial ? "ATUALIZAR AVALIAÇÃO" : "SALVAR AVALIAÇÃO"}</Button><button type="button" className="text-button" onClick={onCancel} disabled={saving}>Cancelar</button></div></form>;
}

export const BODY_MEASUREMENT_LABELS = Object.fromEntries(measurementGroups.flatMap(([, fields]) => fields)) as Record<string, string>;
export const SKINFOLD_LABELS = Object.fromEntries(skinfoldFields) as Record<string, string>;
