"use client";

import { useEffect, useRef, useState } from "react";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}
interface NavigatorWithWakeLock {
  wakeLock: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
}

function isWakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

// Mantém a tela ligada enquanto `enabled` for true (ex.: sessão de treino ativa + preferência
// ligada). Libera automaticamente quando `enabled` vira false, e tenta readquirir quando a aba
// volta a ficar visível — navegadores liberam o wake lock sozinhos ao ir para segundo plano.
export function useScreenWakeLock(enabled: boolean) {
  const [active, setActive] = useState(false);
  const supported = isWakeLockSupported();
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!enabled || !supported) return;
    let cancelled = false;

    async function acquire() {
      try {
        const sentinel = await (navigator as unknown as NavigatorWithWakeLock).wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        setActive(true);
        sentinel.addEventListener("release", () => setActive(false));
      } catch {
        setActive(false);
      }
    }

    void acquire();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && !sentinelRef.current) void acquire();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      setActive(false);
      if (sentinel) void sentinel.release().catch(() => undefined);
    };
  }, [enabled, supported]);

  return { active, supported };
}
