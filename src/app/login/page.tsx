"use client";

import { Button, Card } from "@/components/ui";
import { createFirstAdmin, friendlyAuthError, getSystemConfig, login, loginAsAdmin, registerUser, resetPassword } from "@/services/auth";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register" | "admin";

export default function Login() {
  const [initial, setInitial] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [adminLogin, setAdminLogin] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const registration = mode === "register" || mode === "admin";

  useEffect(() => { getSystemConfig().then(config => setInitial(!config?.initialized)).catch(() => setInitial(true)); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const form = new FormData(event.currentTarget); const email = String(form.get("email")); const password = String(form.get("password"));
    try {
      if (registration) {
        if (password !== String(form.get("confirm"))) throw new Error("As senhas não conferem.");
        const data = { name: String(form.get("name")), email, password };
        if (mode === "admin") await createFirstAdmin(data); else await registerUser(data);
      } else if (adminLogin) await loginAsAdmin(email, password); else await login(email, password);
      router.push(adminLogin ? "/admin" : "/");
    } catch (error) { setMessage(error instanceof Error && error.message === "Esta conta não possui acesso administrativo." ? error.message : friendlyAuthError(error)); }
  }

  const title = mode === "admin" ? "Criar administrador" : mode === "register" ? "Crie sua conta" : adminLogin ? "Acesso administrativo" : "Entre na sua conta";
  return <div className="auth"><div className="auth-brand">X<span>Trainer</span></div><Card>
    <p className="eyebrow">BEM-VINDO</p><h1>{title}</h1><p className="muted">{registration ? "Preencha seus dados para acessar seu treino." : adminLogin ? "Use as credenciais da conta administradora." : "Acompanhe cada repetição da sua evolução."}</p>
    <form onSubmit={submit}>
      {registration && <label>Nome<input required name="name" placeholder="Seu nome" /></label>}
      <label>E-mail<input required name="email" type="email" placeholder="voce@email.com" /></label>
      <label>Senha<input required minLength={6} name="password" type="password" placeholder="Mínimo 6 caracteres" /></label>
      {registration && <label>Confirmar senha<input required name="confirm" type="password" placeholder="Repita sua senha" /></label>}
      <Button type="submit">{mode === "admin" ? "CRIAR ADMINISTRADOR" : mode === "register" ? "CRIAR CONTA" : adminLogin ? "ENTRAR COMO ADMINISTRADOR" : "ENTRAR"}</Button>
    </form>
    {message && <p className="error">{message}</p>}
    {mode === "login" && !adminLogin && <div className="auth-actions"><button type="button" className="text-button" onClick={async () => { const email = prompt("Informe seu e-mail"); if (email) { await resetPassword(email); setMessage("E-mail de recuperação enviado."); } }}>Esqueci minha senha</button><button type="button" className="secondary-button" onClick={() => setMode("register")}>CADASTRAR NOVO USUÁRIO</button><button type="button" className="admin-button" onClick={() => { setAdminLogin(true); setMessage(""); }}>ENTRAR COMO ADMINISTRADOR</button>{initial && <button type="button" className="admin-button" onClick={() => setMode("admin")}>PRIMEIRO ACESSO: CRIAR ADMINISTRADOR</button>}</div>}
    {(mode !== "login" || adminLogin) && <button type="button" className="text-button" onClick={() => { setMode("login"); setAdminLogin(false); setMessage(""); }}>Voltar para entrar</button>}
  </Card></div>;
}
