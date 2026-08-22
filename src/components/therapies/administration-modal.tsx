"use client";

import { Button } from "@/components/ui";
import { formatDateBR } from "@/lib/utils";
import type { AdministrationStatus } from "@/types";
import { X } from "lucide-react";
import { useState } from "react";

export interface AdministrationTarget {
  medicationName: string;
  scheduledDate: string;
  action: AdministrationStatus;
}

export interface AdministrationSubmitValue {
  actualDate?: string;
  reportedAmount?: number;
  reportedUnit?: string;
  notes?: string;
}

const ACTION_TITLES: Record<AdministrationStatus, string> = { completed: "Confirmar registro", postponed: "Adiar registro", skipped: "Pular registro" };

export function AdministrationModal({ target, saving, onSubmit, onClose }: {
  target: AdministrationTarget;
  saving: boolean;
  onSubmit: (value: AdministrationSubmitValue) => Promise<void>;
  onClose: () => void;
}) {
  const [actualDate, setActualDate] = useState(target.action === "completed" ? new Date().toISOString().slice(0, 10) : "");
  const [reportedAmount, setReportedAmount] = useState("");
  const [reportedUnit, setReportedUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (target.action === "postponed" && !actualDate) return setError("Escolha a nova data.");
    try {
      await onSubmit({
        actualDate: actualDate || undefined,
        reportedAmount: reportedAmount === "" ? undefined : Number(reportedAmount),
        reportedUnit: reportedUnit || undefined,
        notes: notes.trim() || undefined,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível registrar.");
    }
  }

  return <div className="method-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="method-dialog" role="dialog" aria-modal="true" aria-labelledby="administration-dialog-title">
      <header><div><p className="eyebrow">SAÚDE E TERAPIAS</p><h2 id="administration-dialog-title">{ACTION_TITLES[target.action]}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X/></button></header>
      <p><strong>{target.medicationName}</strong> · previsto para {formatDateBR(target.scheduledDate)}</p>
      <form onSubmit={submit}>
        {target.action !== "skipped" && <label>{target.action === "completed" ? "Data realizada" : "Nova data"}<input required={target.action === "postponed"} type="date" value={actualDate} onChange={(event) => setActualDate(event.target.value)}/></label>}
        {target.action === "completed" && <div className="form-grid"><label>Quantidade registrada<input inputMode="decimal" value={reportedAmount} onChange={(event) => setReportedAmount(event.target.value)} placeholder="Opcional"/></label><label>Unidade<select value={reportedUnit} onChange={(event) => setReportedUnit(event.target.value)}><option value="">—</option><option value="mg">mg</option><option value="mL">mL</option><option value="UI">UI</option><option value="comprimido">comprimido</option><option value="cápsula">cápsula</option><option value="outra">outra</option></select></label></div>}
        <label>Observações<textarea value={notes} onChange={(event) => setNotes(event.target.value)}/></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="actions"><Button disabled={saving}>{saving ? "SALVANDO..." : "CONFIRMAR"}</Button><button type="button" className="text-button" onClick={onClose} disabled={saving}>Cancelar</button></div>
      </form>
    </section>
  </div>;
}
