"use client";

import { Button } from "@/components/ui";
import { therapySchema } from "@/lib/validation";
import type { MedicationSchedule, Therapy, TherapyMedication, TherapyStatus } from "@/types";
import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

export type TherapyFormValue = {
  name: string;
  startDate: string;
  endDate?: string;
  continuous: boolean;
  status: TherapyStatus;
  medications: TherapyMedication[];
  notes?: string;
  reminderOffsetDays?: number;
};

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const newMedication = (): TherapyMedication => ({ id: crypto.randomUUID(), name: "", schedule: { type: "interval", intervalDays: 1 } });

function ScheduleEditor({ schedule, onChange }: { schedule: MedicationSchedule; onChange: (value: MedicationSchedule) => void }) {
  return <div className="schedule-editor">
    <label>Frequência informada<select value={schedule.type} onChange={(event) => {
      const type = event.target.value as MedicationSchedule["type"];
      onChange(type === "interval" ? { type, intervalDays: 1 } : type === "weekdays" ? { type, weekdays: [] } : { type, dates: [] });
    }}><option value="interval">A cada X dias</option><option value="weekdays">Dias da semana</option><option value="custom">Datas personalizadas</option></select></label>
    {schedule.type === "interval" && <label>A cada<input type="number" min="1" step="1" value={schedule.intervalDays} onChange={(event) => onChange({ type: "interval", intervalDays: Number(event.target.value) })}/><small>dias</small></label>}
    {schedule.type === "weekdays" && <fieldset className="weekday-picker"><legend>Dias da semana</legend>{WEEKDAY_LABELS.map((label, index) => <label className="check-label" key={label}><input type="checkbox" checked={schedule.weekdays.includes(index)} onChange={(event) => onChange({ type: "weekdays", weekdays: event.target.checked ? [...schedule.weekdays, index].sort() : schedule.weekdays.filter((day) => day !== index) })}/>{label}</label>)}</fieldset>}
    {schedule.type === "custom" && <div className="custom-dates"><div className="custom-dates-list">{schedule.dates.map((date, index) => <span className="custom-date-chip" key={`${date}-${index}`}>{date}<button type="button" onClick={() => onChange({ type: "custom", dates: schedule.dates.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Remover ${date}`}><X size={13}/></button></span>)}</div><input type="date" onChange={(event) => { const value = event.target.value; if (!value || schedule.dates.includes(value)) return; onChange({ type: "custom", dates: [...schedule.dates, value].sort() }); event.target.value = ""; }}/></div>}
  </div>;
}

export function TherapyForm({ initial, saving, onSave, onCancel }: {
  initial?: Therapy | null;
  saving: boolean;
  onSave: (value: TherapyFormValue) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [continuous, setContinuous] = useState(initial?.continuous ?? false);
  const [status, setStatus] = useState<TherapyStatus>(initial?.status ?? "active");
  const [medications, setMedications] = useState<TherapyMedication[]>(initial?.medications?.length ? initial.medications : [newMedication()]);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [reminderOffsetDays, setReminderOffsetDays] = useState(initial?.reminderOffsetDays ?? -1);
  const [error, setError] = useState("");

  function updateMedication(id: string, data: Partial<TherapyMedication>) {
    setMedications((items) => items.map((item) => item.id === id ? { ...item, ...data } : item));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const value = { name: name.trim(), startDate, endDate: continuous ? undefined : endDate, continuous, medications, notes: notes.trim() || undefined };
    const result = therapySchema.safeParse(value);
    if (!result.success) return setError(result.error.issues[0]?.message ?? "Revise os dados da terapia.");
    try {
      await onSave({ ...value, status, reminderOffsetDays: reminderOffsetDays >= 0 ? reminderOffsetDays : undefined });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar a terapia.");
    }
  }

  return <form className="therapy-form" onSubmit={submit}>
    <div className="form-grid">
      <label>Nome da terapia<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Tratamento prescrito"/></label>
      <label>Data de início<input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)}/></label>
      <label>Modo<select value={continuous ? "continuous" : "ended"} onChange={(event) => setContinuous(event.target.value === "continuous")}><option value="ended">Com data final</option><option value="continuous">Contínuo</option></select></label>
      {continuous ? <p className="muted">Sem data final programada.</p> : <label>Data final<input required={!continuous} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)}/></label>}
      {initial && <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as TherapyStatus)}><option value="active">Em andamento</option><option value="paused">Pausada</option><option value="completed">Concluída</option></select></label>}
      <label>Lembrete<select value={reminderOffsetDays} onChange={(event) => setReminderOffsetDays(Number(event.target.value))}><option value={-1}>Não lembrar</option><option value={0}>No dia</option><option value={1}>1 dia antes</option><option value={2}>2 dias antes</option></select></label>
    </div>

    <div className="therapy-medications">
      <div className="therapy-medications-title"><h3>Medicamentos</h3><button type="button" className="text-button" onClick={() => setMedications((items) => [...items, newMedication()])}><Plus size={15}/> Adicionar medicamento</button></div>
      {medications.map((medication) => <div className="card therapy-medication-item" key={medication.id}>
        <div className="form-grid">
          <label>Medicamento/substância<input required value={medication.name} onChange={(event) => updateMedication(medication.id, { name: event.target.value })}/></label>
          <label>Apresentação<input value={medication.formulation ?? ""} onChange={(event) => updateMedication(medication.id, { formulation: event.target.value || undefined })} placeholder="Opcional"/></label>
          <label>Quantidade informada<input inputMode="decimal" value={medication.reportedAmount ?? ""} onChange={(event) => updateMedication(medication.id, { reportedAmount: event.target.value === "" ? undefined : Number(event.target.value) })} placeholder="Opcional"/></label>
          <label>Unidade<select value={medication.reportedUnit ?? ""} onChange={(event) => updateMedication(medication.id, { reportedUnit: event.target.value || undefined })}><option value="">—</option><option value="mg">mg</option><option value="mL">mL</option><option value="UI">UI</option><option value="comprimido">comprimido</option><option value="cápsula">cápsula</option><option value="outra">outra</option></select></label>
        </div>
        <ScheduleEditor schedule={medication.schedule} onChange={(schedule) => updateMedication(medication.id, { schedule })}/>
        <label>Observações<textarea value={medication.notes ?? ""} onChange={(event) => updateMedication(medication.id, { notes: event.target.value || undefined })}/></label>
        {medications.length > 1 && <button type="button" className="text-button danger-text" onClick={() => setMedications((items) => items.filter((item) => item.id !== medication.id))}><Trash2 size={15}/> Remover medicamento</button>}
      </div>)}
    </div>

    <label>Observações da terapia<textarea value={notes} onChange={(event) => setNotes(event.target.value)}/></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="actions"><Button disabled={saving}>{saving ? "SALVANDO..." : initial ? "SALVAR ALTERAÇÕES" : "REGISTRAR TERAPIA"}</Button><button type="button" className="text-button" onClick={onCancel} disabled={saving}>Cancelar</button></div>
  </form>;
}
