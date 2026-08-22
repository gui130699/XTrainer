"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "xtrainer-theme";
type Theme = "dark" | "light";

export function ThemeToggle({ className = "" }: { className?: string }) {
  // O servidor sempre renderiza "dark" (não há acesso ao DOM/localStorage durante o build
  // estático). Sincronizamos com o tema real assim que o componente monta no navegador,
  // depois que a hidratação já terminou, para não gerar divergência entre servidor e cliente.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com o atributo já aplicado pelo script anti-flash em <head>, executado antes da hidratação.
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* armazenamento indisponível neste navegador */ }
  }

  return <button type="button" className={`icon-button theme-toggle ${className}`} onClick={toggle} aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"} title={theme === "light" ? "Tema escuro" : "Tema claro"} suppressHydrationWarning>
    {theme === "light" ? <Moon size={18}/> : <Sun size={18}/>}
  </button>;
}
