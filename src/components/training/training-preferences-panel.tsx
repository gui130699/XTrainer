"use client";

import { Button } from "@/components/ui";
import type { TrainingPreferences } from "@/hooks/use-training-preferences";
import { playRestFinishedSound, primeTrainingAudio, vibrateRestFinished } from "@/lib/training-alerts";
import { X } from "lucide-react";

export function TrainingPreferencesPanel({ preferences, wakeLockSupported, onUpdate, onClose }: {
  preferences: TrainingPreferences;
  wakeLockSupported: boolean;
  onUpdate: (patch: Partial<TrainingPreferences>) => void;
  onClose: () => void;
}) {
  function testAlert() {
    primeTrainingAudio();
    if (preferences.soundEnabled) playRestFinishedSound();
    if (preferences.vibrationEnabled) vibrateRestFinished();
  }

  return <div className="method-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="method-dialog" role="dialog" aria-modal="true" aria-labelledby="training-preferences-title">
      <header><div><p className="eyebrow">PREFERÊNCIAS DO TREINO</p><h2 id="training-preferences-title">Alertas e tela</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X/></button></header>
      <div className="training-preferences-list">
        <div className="training-preference-row"><div><strong>Som ao finalizar descanso</strong><small>Toque curto e discreto quando o cronômetro zerar.</small></div><label className="toggle-switch"><input type="checkbox" checked={preferences.soundEnabled} onChange={(event) => onUpdate({ soundEnabled: event.target.checked })}/><span/></label></div>
        <div className="training-preference-row"><div><strong>Vibração</strong><small>Vibra o aparelho quando o descanso termina, se suportado.</small></div><label className="toggle-switch"><input type="checkbox" checked={preferences.vibrationEnabled} onChange={(event) => onUpdate({ vibrationEnabled: event.target.checked })}/><span/></label></div>
        <div className="training-preference-row"><div><strong>Manter tela ligada</strong><small>{wakeLockSupported ? "Evita a tela apagar durante a sessão de treino." : "Seu navegador não oferece suporte a manter a tela ativa."}</small></div><label className="toggle-switch"><input type="checkbox" checked={preferences.wakeLockEnabled} disabled={!wakeLockSupported} onChange={(event) => onUpdate({ wakeLockEnabled: event.target.checked })}/><span/></label></div>
        <div className="training-preference-row"><div><strong>Aviso nos últimos segundos</strong><small>Um sinal discreto nos 3 segundos finais do descanso.</small></div><label className="toggle-switch"><input type="checkbox" checked={preferences.countdownAlertEnabled} onChange={(event) => onUpdate({ countdownAlertEnabled: event.target.checked })}/><span/></label></div>
      </div>
      <Button className="outline" onClick={testAlert} type="button">TESTAR ALERTA</Button>
    </section>
  </div>;
}
