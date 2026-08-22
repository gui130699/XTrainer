"use client";

import { Button } from "@/components/ui";
import { X } from "lucide-react";
import { useState } from "react";

const REASONS: [string, string][] = [
  ["equipment-busy", "Equipamento ocupado"],
  ["no-time", "Falta de tempo"],
  ["discomfort", "Desconforto"],
  ["unavailable", "Indisponível"],
  ["other", "Outro"],
];

export function SkipExerciseModal({ exerciseName, saving, onConfirm, onCancel }: {
  exerciseName: string;
  saving: boolean;
  onConfirm: (reasonCode?: string, reasonText?: string) => void;
  onCancel: () => void;
}) {
  const [reasonCode, setReasonCode] = useState<string | undefined>(undefined);
  const [reasonText, setReasonText] = useState("");

  return <div className="method-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
    <section className="method-dialog skip-exercise-dialog" role="dialog" aria-modal="true" aria-labelledby="skip-dialog-title">
      <header><div><p className="eyebrow">PULAR EXERCÍCIO HOJE?</p><h2 id="skip-dialog-title">{exerciseName}</h2></div><button type="button" className="icon-button" onClick={onCancel} aria-label="Fechar"><X/></button></header>
      <p>Ele será ignorado somente nesta sessão. Sua ficha original continuará igual.</p>
      <fieldset className="skip-reason-fieldset"><legend>Motivo (opcional)</legend>
        {REASONS.map(([code, label]) => <label className="method-check" key={code}><input type="radio" name="skip-reason" checked={reasonCode === code} onChange={() => setReasonCode(code)}/>{label}</label>)}
      </fieldset>
      {reasonCode === "other" && <label>Descreva brevemente<input value={reasonText} onChange={(event) => setReasonText(event.target.value)} maxLength={80}/></label>}
      <div className="actions">
        <button type="button" className="text-button" onClick={onCancel} disabled={saving}>CANCELAR</button>
        <Button onClick={() => onConfirm(reasonCode, reasonCode === "other" ? reasonText.trim() || undefined : undefined)} disabled={saving}>{saving ? "PULANDO..." : "PULAR HOJE"}</Button>
      </div>
    </section>
  </div>;
}
