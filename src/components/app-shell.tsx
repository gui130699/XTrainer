"use client";

import Link from "next/link";
import { BarChart3, Dumbbell, History, Home, LogOut, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AppLogo } from "@/components/app-logo";
import { useAuth } from "@/components/providers";
import { logout } from "@/services/auth";

const links = [["/", "Início", Home], ["/treino", "Treino", Dumbbell], ["/evolucao", "Evolução", BarChart3], ["/historico", "Histórico", History], ["/perfil", "Perfil", UserRound]] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const { admin } = useAuth();

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    addEventListener("online", updateConnection);
    addEventListener("offline", updateConnection);
    return () => {
      removeEventListener("online", updateConnection);
      removeEventListener("offline", updateConnection);
    };
  }, []);

  const role = admin ? "Administrador" : "Usuário";
  return <div className="shell"><aside><Link className="brand" href="/" aria-label="XTrainer - início"><AppLogo size={46}/></Link><nav>{links.map(([href, label, Icon]) => <Link key={href} href={href}><Icon size={20}/>{label}</Link>)}</nav><div className="sidebar-account"><p className="connection" title={online ? "Online" : "Offline"}><UserRound size={15}/>{role}<span className={online ? "online-dot" : "offline-dot"} aria-label={online ? "Online" : "Offline"}/></p><button className="sidebar-logout" onClick={() => void logout()}><LogOut size={16}/> Sair</button></div></aside><main><Link className="mobile-app-brand" href="/" aria-label="XTrainer - início"><AppLogo size={38}/></Link>{children}</main><nav className="bottom-nav">{links.map(([href, label, Icon]) => <Link key={href} href={href}><Icon size={20}/><small>{label}</small></Link>)}</nav></div>;
}
