"use client";

import { Button, Card } from "@/components/ui";
import { AppLogo } from "@/components/app-logo";
import { friendlyAuthError, login, registerUser, resetPassword } from "@/services/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { authSchemasByMode } from "@/lib/validation";
import type { z } from "zod";

type Mode = "login" | "register" | "reset";
const ADMIN_URL = "https://gui130699.github.io/XTrainer-Admin/";
const schemasByMode = authSchemasByMode;

type LoginValues = z.infer<typeof schemasByMode.login>;
type RegisterValues = z.infer<typeof schemasByMode.register>;
type ResetValues = z.infer<typeof schemasByMode.reset>;
type FormValues = { name?: string; email: string; password?: string; confirm?: string };

function AuthForm({ mode, onModeChange }: { mode: Mode; onModeChange: (mode: Mode) => void }) {
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schemasByMode[mode]) });

  const submit = handleSubmit(async (values) => {
    setMessage("");
    setSuccess(false);
    try {
      if (mode === "reset") {
        const { email } = values as ResetValues;
        await resetPassword(email);
        setSuccess(true);
        setMessage("E-mail de recuperação enviado. Verifique sua caixa de entrada.");
        return;
      }
      if (mode === "register") {
        const { name, email, password } = values as RegisterValues;
        await registerUser({ name, email, password });
      } else {
        const { email, password } = values as LoginValues;
        await login(email, password);
      }
      router.push("/");
    } catch (error) {
      setMessage(friendlyAuthError(error));
    }
  });

  const fieldError = errors.name?.message ?? errors.email?.message ?? errors.password?.message ?? errors.confirm?.message;
  const title = mode === "register" ? "Crie sua conta" : mode === "reset" ? "Recuperar senha" : "Entre na sua conta";

  return <Card>
    <p className="eyebrow">BEM-VINDO</p><h1>{title}</h1>
    <p className="muted">{mode === "register" ? "Preencha seus dados para acessar seu treino." : mode === "reset" ? "Enviaremos as instruções para seu e-mail." : "Acompanhe cada repetição da sua evolução."}</p>
    <form onSubmit={submit} noValidate>
      {mode === "register" && <label>Nome<input {...register("name")} autoComplete="name" placeholder="Seu nome" /></label>}
      <label>E-mail<input {...register("email")} type="email" autoComplete="email" placeholder="voce@email.com" /></label>
      {mode !== "reset" && <label>Senha<input {...register("password")} type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="Mínimo 6 caracteres" /></label>}
      {mode === "register" && <label>Confirmar senha<input {...register("confirm")} type="password" autoComplete="new-password" placeholder="Repita sua senha" /></label>}
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "AGUARDE..." : mode === "register" ? "CRIAR CONTA" : mode === "reset" ? "ENVIAR RECUPERAÇÃO" : "ENTRAR"}</Button>
    </form>
    {(fieldError || message) && <p className={!fieldError && success ? "success" : "error"} role="status">{fieldError ?? message}</p>}
    {mode === "login" ? <div className="auth-actions">
      <button type="button" className="text-button" onClick={() => onModeChange("reset")}>Esqueci minha senha</button>
      <button type="button" className="secondary-button" onClick={() => onModeChange("register")}>CADASTRAR NOVO USUÁRIO</button>
      <a className="admin-button" href={ADMIN_URL}>ABRIR PAINEL ADMINISTRATIVO</a>
    </div> : <button type="button" className="text-button" onClick={() => onModeChange("login")}>Voltar para entrar</button>}
  </Card>;
}

export default function Login() {
  const [mode, setMode] = useState<Mode>("login");
  return <div className="auth"><div className="auth-brand" aria-label="XTrainer"><AppLogo size={64}/></div>
    <AuthForm key={mode} mode={mode} onModeChange={setMode}/>
  </div>;
}
