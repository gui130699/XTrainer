"use client";

import { useState } from "react";

const STORAGE_KEY = "xtrainer:training-preferences:v1";

export interface TrainingPreferences {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  wakeLockEnabled: boolean;
  countdownAlertEnabled: boolean;
}

export const DEFAULT_TRAINING_PREFERENCES: TrainingPreferences = {
  soundEnabled: true,
  vibrationEnabled: true,
  wakeLockEnabled: true,
  countdownAlertEnabled: false,
};

// Validação defensiva: um JSON inválido, de outra versão ou corrompido nunca derruba a tela,
// apenas cai nos padrões.
export function parseTrainingPreferences(raw: string | null): TrainingPreferences {
  if (!raw) return DEFAULT_TRAINING_PREFERENCES;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_TRAINING_PREFERENCES;
    const value = parsed as Partial<TrainingPreferences>;
    return {
      soundEnabled: typeof value.soundEnabled === "boolean" ? value.soundEnabled : DEFAULT_TRAINING_PREFERENCES.soundEnabled,
      vibrationEnabled: typeof value.vibrationEnabled === "boolean" ? value.vibrationEnabled : DEFAULT_TRAINING_PREFERENCES.vibrationEnabled,
      wakeLockEnabled: typeof value.wakeLockEnabled === "boolean" ? value.wakeLockEnabled : DEFAULT_TRAINING_PREFERENCES.wakeLockEnabled,
      countdownAlertEnabled: typeof value.countdownAlertEnabled === "boolean" ? value.countdownAlertEnabled : DEFAULT_TRAINING_PREFERENCES.countdownAlertEnabled,
    };
  } catch {
    return DEFAULT_TRAINING_PREFERENCES;
  }
}

function readTrainingPreferences(): TrainingPreferences {
  if (typeof window === "undefined") return DEFAULT_TRAINING_PREFERENCES;
  try {
    return parseTrainingPreferences(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_TRAINING_PREFERENCES;
  }
}

function writeTrainingPreferences(value: TrainingPreferences) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* armazenamento indisponível neste navegador */ }
}

export function useTrainingPreferences() {
  const [preferences, setPreferences] = useState<TrainingPreferences>(() => readTrainingPreferences());

  function update(patch: Partial<TrainingPreferences>) {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      writeTrainingPreferences(next);
      return next;
    });
  }

  return { preferences, update };
}
