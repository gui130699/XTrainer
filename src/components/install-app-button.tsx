"use client";

import { Download, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || iosNavigator.standalone === true;
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsIos(false);
      setShowIosHelp(false);
    };

    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!installPrompt && !isIos) return null;

  async function install() {
    if (isIos) {
      setShowIosHelp(true);
      return;
    }
    if (!installPrompt) return;
    const prompt = installPrompt;
    setInstallPrompt(null);
    await prompt.prompt();
    await prompt.userChoice;
  }

  return <div className="install-app">
    {showIosHelp && <div className="install-help" role="dialog" aria-label="Como instalar o XTrainer">
      <button className="install-help-close" onClick={() => setShowIosHelp(false)} aria-label="Fechar instruções"><X size={17}/></button>
      <strong>Instalar o XTrainer</strong>
      <p><Share2 size={16}/> No Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</p>
    </div>}
    <button className="install-app-button" onClick={() => void install()}><Download size={18}/> INSTALAR APP</button>
  </div>;
}
