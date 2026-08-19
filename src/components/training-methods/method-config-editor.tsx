"use client";
import { sanitizeConfigValue } from "@/lib/training-methods";
import type { TrainingMethodConfig, TrainingMethodConfigField, TrainingMethodConfigValue, TrainingMethodSnapshot, TrainingTempo } from "@/types";

function Field({ field, value, onChange }: { field: TrainingMethodConfigField; value: TrainingMethodConfigValue | undefined; onChange: (value: TrainingMethodConfigValue) => void }) {
  if (field.type === "boolean") return <label className="method-check"><input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)}/>{field.label}</label>;
  if (field.type === "select") return <label>{field.label}<select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>{field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>{field.help && <small>{field.help}</small>}</label>;
  if (field.type === "tempo") {
    const tempo = value && typeof value === "object" ? value as TrainingTempo : { eccentric: 0, pause: 0, concentric: 0, top: 0 };
    return <fieldset className="tempo-field"><legend>{field.label}</legend>{(["eccentric", "pause", "concentric", "top"] as const).map((key) => <label key={key}>{key === "eccentric" ? "Excêntrica" : key === "pause" ? "Pausa" : key === "concentric" ? "Concêntrica" : "Topo"}<input type="number" min="0" step="1" value={tempo[key]} onChange={(event) => onChange({ ...tempo, [key]: Math.max(0, Number(event.target.value)) })}/></label>)}</fieldset>;
  }
  return <label>{field.label}<input type={field.type === "text" ? "text" : "number"} min={field.min} max={field.max} step={field.step ?? (field.type === "integer" || field.type === "seconds" || field.type === "reps" ? 1 : 0.1)} value={String(value ?? "")} onChange={(event) => onChange(sanitizeConfigValue(field, event.target.value))}/>{field.help && <small>{field.help}</small>}</label>;
}

export function MethodConfigEditor({ method, config, onChange }: { method: TrainingMethodSnapshot; config: TrainingMethodConfig; onChange: (config: TrainingMethodConfig) => void }) {
  if (!method.configFields.length) return <p className="method-default-note">Este método usa apenas séries, repetições, carga e descanso.</p>;
  return <div className="method-config-grid">{method.configFields.map((field) => <Field key={field.key} field={field} value={config.values[field.key] ?? method.defaults[field.key]} onChange={(value) => onChange({ methodId: method.id, values: { ...config.values, [field.key]: value } })}/>)}</div>;
}

