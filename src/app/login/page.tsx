"use client";

import { Button, Card } from "@/components/ui";
import { AppLogo } from "@/components/app-logo";
import { friendlyAuthError, login, registerUser, resetPassword } from "@/services/auth";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register" | "reset";
const ADMIN_URL = "https://gui130699.github.io/XTrainer-Admin/";

export default function Login() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    try {
      if (mode === "reset") {
        await resetPassword(email);
        setSuccess(true);
        setMessage("E-mail de recuperação enviado. Verifique sua caixa de entrada.");
        return;
      }
      if (mode === "register") {
        if (password !== String(form.get("confirm"))) throw new Error("As senhas não conferem.");
        await registerUser({ name: String(form.get("name")), email, password });
      } else {
        await login(email, password);
      }
      router.push("/");
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "register" ? "Crie sua conta" : mode === "reset" ? "Recuperar senha" : "Entre na sua conta";
  return <div className="auth"><div className="auth-brand" aria-label="XTrainer"><AppLogo size={64}/></div><Card>
    <p className="eyebrow">BEM-VINDO</p><h1>{title}</h1>
    <p className="muted">{mode === "register" ? "Preencha seus dados para acessar seu treino." : mode === "reset" ? "Enviaremos as instruções para seu e-mail." : "Acompanhe cada repetição da sua evolução."}</p>
    <form onSubmit={submit}>
      {mode === "register" && <label>Nome<input required name="name" autoComplete="name" placeholder="Seu nome" /></label>}
      <label>E-mail<input required name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" /></label>
      {mode !== "reset" && <label>Senha<input required minLength={6} name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="Mínimo 6 caracteres" /></label>}
      {mode === "register" && <label>Confirmar senha<input required minLength={6} name="confirm" type="password" autoComplete="new-password" placeholder="Repita sua senha" /></label>}
      <Button type="submit" disabled={submitting}>{submitting ? "AGUARDE..." : mode === "register" ? "CRIAR CONTA" : mode === "reset" ? "ENVIAR RECUPERAÇÃO" : "ENTRAR"}</Button>
    </form>
    {message && <p className={success ? "success" : "error"} role="status">{message}</p>}
    {mode === "login" ? <div className="auth-actions">
      <button type="button" className="text-button" onClick={() => { setMode("reset"); setMessage(""); }}>Esqueci minha senha</button>
      <button type="button" className="secondary-button" onClick={() => { setMode("register"); setMessage(""); }}>CADASTRAR NOVO USUÁRIO</button>
      <a className="admin-button" href={ADMIN_URL}>ABRIR PAINEL ADMINISTRATIVO</a>
    </div> : <button type="button" className="text-button" onClick={() => { setMode("login"); setMessage(""); }}>Voltar para entrar</button>}
  </Card></div>;
}
