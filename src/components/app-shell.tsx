"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ChevronsLeft, ChevronsRight, Dumbbell, History, Home, LogOut, Sparkles, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AppLogo } from "@/components/app-logo";
import { useAuth } from "@/components/providers";
import { logout } from "@/services/auth";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [["/", "Início", Home], ["/treino", "Treino", Dumbbell], ["/evolucao", "Evolução", BarChart3], ["/historico", "Histórico", History], ["/resumos", "Resumos", Sparkles], ["/perfil", "Perfil", UserRound]] as const;
const COLLAPSE_KEY = "xtrainer-sidebar-collapsed";

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [collapsed, setCollapsed] = useState(false);
  const { admin } = useAuth();
  const path = usePathname();

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    addEventListener("online", updateConnection);
    addEventListener("offline", updateConnection);
    return () => {
      removeEventListener("online", updateConnection);
      removeEventListener("offline", updateConnection);
    };
  }, []);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com a preferência salva no navegador (localStorage), indisponível durante o prerender estático.
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch { /* armazenamento indisponível neste navegador */ }
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch { /* armazenamento indisponível */ }
      return next;
    });
  }

  const role = admin ? "Administrador" : "Usuário";
  return <div className={`shell ${collapsed ? "sidebar-collapsed" : ""}`}>
    <aside>
      <Link className="brand" href="/" aria-label="XTrainer - início"><AppLogo size={collapsed ? 34 : 46}/></Link>
      <nav>{links.map(([href, label, Icon]) => <Link key={href} className={isActive(path, href) ? "active" : ""} href={href} title={collapsed ? label : undefined} aria-current={isActive(path, href) ? "page" : undefined}><Icon size={20}/><span className="nav-label">{label}</span></Link>)}</nav>
      <div className="sidebar-account">
        <p className="connection" title={online ? "Online" : "Offline"}><UserRound size={15}/><span className="nav-label">{role}</span><span className={online ? "online-dot" : "offline-dot"} aria-label={online ? "Online" : "Offline"}/></p>
        <ThemeToggle className="sidebar-theme-toggle"/>
        <button className="sidebar-logout" onClick={() => void logout()}><LogOut size={16}/><span className="nav-label">Sair</span></button>
        <button className="sidebar-collapse-toggle" onClick={toggleCollapsed} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir menu" : "Recolher menu"}>{collapsed ? <ChevronsRight size={16}/> : <ChevronsLeft size={16}/>}</button>
      </div>
    </aside>
    <main>
      <div className="mobile-topbar"><Link className="mobile-app-brand" href="/" aria-label="XTrainer - início"><AppLogo size={38}/></Link><ThemeToggle/></div>
      {children}
    </main>
    <nav className="bottom-nav">{links.map(([href, label, Icon]) => <Link key={href} className={isActive(path, href) ? "active" : ""} href={href} aria-current={isActive(path, href) ? "page" : undefined}><Icon size={20}/><small>{label}</small></Link>)}</nav>
  </div>;
}
