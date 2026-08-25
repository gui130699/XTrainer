"use client";

import { Button } from "@/components/ui";
import { X } from "lucide-react";

export function AlertDialog({ eyebrow, title, message, confirmLabel, cancelLabel = "CANCELAR", disabled, onConfirm, onCancel }: {
  eyebrow: string;
  title: string;
  message: string;
  confirmLabel: React.ReactNode;
  cancelLabel?: string;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return <div className="method-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
    <section className="method-dialog alert-dialog" role="alertdialog" aria-modal="true" aria-labelledby="alert-dialog-title">
      <header><div><p className="eyebrow">{eyebrow}</p><h2 id="alert-dialog-title">{title}</h2></div><button type="button" className="icon-button" onClick={onCancel} aria-label="Fechar" disabled={disabled}><X/></button></header>
      <p>{message}</p>
      <div className="alert-dialog-actions">
        <button type="button" className="text-button" onClick={onCancel} disabled={disabled}>{cancelLabel}</button>
        <Button className="danger" onClick={onConfirm} disabled={disabled}>{confirmLabel}</Button>
      </div>
    </section>
  </div>;
}
