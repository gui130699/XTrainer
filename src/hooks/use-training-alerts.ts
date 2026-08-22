"use client";

import { useEffect, useRef } from "react";
import { nextRestAlertKey, playCountdownTickSound, playRestFinishedSound, shouldEmitCountdownTick, vibrateCountdownTick, vibrateRestFinished } from "@/lib/training-alerts";
import type { TrainingPreferences } from "@/hooks/use-training-preferences";

// Som e vibração do fim do descanso, sem duplicar o timer existente: só observa restSeconds/
// restEndsAt e decide, via lógica pura testável, se já emitiu o alerta daquele restEndsAt.
export function useTrainingAlerts(restSeconds: number, restEndsAtMillis: number | null, preferences: TrainingPreferences) {
  const alertKeyRef = useRef<string | null>(null);
  const countdownSecondRef = useRef<number | null>(null);

  useEffect(() => {
    const { shouldAlert, nextKey } = nextRestAlertKey(alertKeyRef.current, restSeconds, restEndsAtMillis);
    alertKeyRef.current = nextKey;
    if (shouldAlert) {
      if (preferences.soundEnabled) playRestFinishedSound();
      if (preferences.vibrationEnabled) vibrateRestFinished();
    }
    if (preferences.countdownAlertEnabled && shouldEmitCountdownTick(countdownSecondRef.current, restSeconds)) {
      countdownSecondRef.current = restSeconds;
      if (preferences.soundEnabled) playCountdownTickSound();
      if (preferences.vibrationEnabled) vibrateCountdownTick();
    }
    if (restSeconds <= 0) countdownSecondRef.current = null;
  }, [restSeconds, restEndsAtMillis, preferences.soundEnabled, preferences.vibrationEnabled, preferences.countdownAlertEnabled]);
}
