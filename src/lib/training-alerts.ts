// Lógica pura de deduplicação do alerta final do cronômetro de descanso: garante que o
// som/vibração/notificação de "descanso finalizado" dispare uma única vez por restEndsAt, mesmo
// com múltiplos renders/timers observando o mesmo relógio. Testável sem Web Audio/Notifications.
export function nextRestAlertKey(previousKey: string | null, restSeconds: number, restEndsAtMillis: number | null): { shouldAlert: boolean; nextKey: string | null } {
  if (restSeconds > 0 || restEndsAtMillis == null) return { shouldAlert: false, nextKey: previousKey };
  const key = String(restEndsAtMillis);
  if (previousKey === key) return { shouldAlert: false, nextKey: key };
  return { shouldAlert: true, nextKey: key };
}

// Aviso discreto nos últimos segundos (opcional). Dispara uma vez por segundo restante dentro da
// janela, nunca repetido para o mesmo segundo.
export function shouldEmitCountdownTick(previousSecond: number | null, restSeconds: number, windowSeconds = 3): boolean {
  if (restSeconds <= 0 || restSeconds > windowSeconds) return false;
  return previousSecond !== restSeconds;
}

let audioContext: AudioContext | null = null;

function ensureAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window || "webkitAudioContext" in window)) return null;
  if (!audioContext) {
    const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    audioContext = new Ctor();
  }
  if (audioContext.state === "suspended") void audioContext.resume().catch(() => undefined);
  return audioContext;
}

// Deve ser chamada a partir de uma interação legítima do usuário (ex.: iniciar treino, tocar em
// "Ativar alertas") para satisfazer as políticas de autoplay dos navegadores.
export function primeTrainingAudio() {
  ensureAudioContext();
}

function tone(frequency: number, durationSeconds: number, peakGain: number) {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationSeconds);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + durationSeconds + 0.02);
}

// Som curto e discreto, não irritante — sem arquivo remoto, sintetizado via Web Audio API.
export function playRestFinishedSound() { tone(880, 0.35, 0.18); }
export function playCountdownTickSound() { tone(660, 0.08, 0.08); }

export function vibrateRestFinished() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([100, 60, 100]);
}
export function vibrateCountdownTick() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(40);
}
