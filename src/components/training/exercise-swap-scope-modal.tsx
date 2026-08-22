"use client";

import { Button } from "@/components/ui";
import type { SubstitutionType } from "@/types";
import { X } from "lucide-react";
import { useState } from "react";

export function ExerciseSwapScopeModal({ fromName, toName, saving, onConfirm, onCancel }: {
  fromName: string;
  toName: string;
  saving: boolean;
  onConfirm: (scope: SubstitutionType) => void;
  onCancel: () => void;
}) {
  const [confirmingPermanent, setConfirmingPermanent] = useState(false);

  if (confirmingPermanent) {
    return <div className="method-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="method-dialog swap-scope-dialog" role="alertdialog" aria-modal="true" aria-labelledby="swap-confirm-title">
        <header><div><p className="eyebrow">CONFIRMAR TROCA</p><h2 id="swap-confirm-title">Alterar definitivamente?</h2></div><button type="button" className="icon-button" onClick={onCancel} aria-label="Fechar"><X/></button></header>
        <p>Essa alteração também será usada nas próximas execuções deste treino.</p>
        <div className="actions">
          <button type="button" className="text-button" onClick={() => setConfirmingPermanent(false)} disabled={saving}>VOLTAR</button>
          <Button onClick={() => onConfirm("permanent")} disabled={saving}>{saving ? "ALTERANDO..." : "ALTERAR DEFINITIVAMENTE"}</Button>
        </div>
      </section>
    </div>;
  }

  return <div className="method-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
    <section className="method-dialog swap-scope-dialog" role="dialog" aria-modal="true" aria-labelledby="swap-scope-title">
      <header><div><p className="eyebrow">SUBSTITUIR EXERCÍCIO</p><h2 id="swap-scope-title">Como deseja aplicar?</h2></div><button type="button" className="icon-button" onClick={onCancel} aria-label="Fechar"><X/></button></header>
      <p className="swap-scope-preview"><span>{fromName}</span><span aria-hidden="true">↓</span><strong>{toName}</strong></p>
      <div className="swap-scope-options">
        <button type="button" className="swap-scope-option" onClick={() => onConfirm("session-only")} disabled={saving}>
          <strong>SÓ NESTA SESSÃO</strong>
          <small>Use o novo exercício apenas hoje. Sua ficha original continuará igual.</small>
        </button>
        <button type="button" className="swap-scope-option" onClick={() => setConfirmingPermanent(true)} disabled={saving}>
          <strong>ALTERAR TREINO DEFINITIVAMENTE</strong>
          <small>Substitui também no treino salvo e nas próximas execuções.</small>
        </button>
      </div>
      <button type="button" className="text-button" onClick={onCancel} disabled={saving}>CANCELAR</button>
    </section>
  </div>;
}
