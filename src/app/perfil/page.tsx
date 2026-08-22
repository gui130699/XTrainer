"use client";

import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/guard";
import { useAuth } from "@/components/providers";
import { Button, Card } from "@/components/ui";
import { changePassword, friendlyAuthError, logout, updateProfile } from "@/services/auth";
import { useEffect, useMemo, useState } from "react";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const pad2 = (value: number) => String(value).padStart(2, "0");

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [height, setHeight] = useState("");
  const [goal, setGoal] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [sex, setSex] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const yearOptions = useMemo(() => Array.from({ length: 100 }, (_, index) => currentYear - 5 - index), [currentYear]);
  const dayOptions = useMemo(() => {
    const total = birthYear && birthMonth ? daysInMonth(Number(birthYear), Number(birthMonth)) : 31;
    return Array.from({ length: total }, (_, index) => index + 1);
  }, [birthYear, birthMonth]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setName(profile?.name ?? "");
      setHeight(profile?.height?.toString() ?? "");
      setGoal(profile?.goal ?? "");
      const [year, month, day] = (profile?.birthDate ?? "").split("-");
      setBirthYear(year ?? "");
      setBirthMonth(month ?? "");
      setBirthDay(day ?? "");
      setSex(profile?.sex ?? "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [profile]);

  if (!user) return null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const normalizedName = name.trim();
      if (!normalizedName) throw new Error("Informe seu nome.");
      const parsedHeight = height === "" ? undefined : Number(height);
      if (parsedHeight !== undefined && (!Number.isFinite(parsedHeight) || parsedHeight <= 0 || parsedHeight > 300)) throw new Error("Informe uma altura válida.");
      const birthDate = birthYear && birthMonth && birthDay ? `${birthYear}-${pad2(Number(birthMonth))}-${pad2(Number(birthDay))}` : undefined;
      await updateProfile(user!.uid, {
        name: normalizedName,
        height: parsedHeight,
        goal: goal.trim() || undefined,
        birthDate,
        sex: sex || undefined,
      });
      await refreshProfile();
      setMessage("Perfil atualizado. As alterações já estão visíveis no aplicativo.");
    } catch (reason) {
      setError(friendlyAuthError(reason));
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordSaving(true);
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    const current = String(form.get("currentPassword"));
    const next = String(form.get("newPassword"));
    const confirm = String(form.get("confirmPassword"));
    try {
      if (next.length < 6) throw new Error("A nova senha deve ter pelo menos 6 caracteres.");
      if (next !== confirm) throw new Error("As novas senhas não conferem.");
      await changePassword(user!, current, next);
      event.currentTarget.reset();
      setMessage("Senha alterada com segurança.");
    } catch (reason) {
      setError(friendlyAuthError(reason));
    } finally {
      setPasswordSaving(false);
    }
  }

  return <AppShell><header><p className="eyebrow">PERFIL</p><div className="profile-heading"><div><h1>{profile?.name || user.displayName || "Seu perfil"}</h1><p>{user.email}</p></div></div></header>
    {message && <p className="success" role="status">{message}</p>}{error && <p className="error" role="alert">{error}</p>}
    <Card><h2>Dados pessoais</h2><p>Informações corporais são opcionais e privadas.</p><form onSubmit={save}><div className="form-grid"><label>Nome<input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name"/></label><label>Altura (cm)<input value={height} onChange={(event) => setHeight(event.target.value)} type="number" min="1" max="300" step="0.1" inputMode="decimal"/></label><label>Objetivo<input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Ex.: hipertrofia"/></label><label>Data de nascimento<div className="birth-date-fields"><select aria-label="Dia" value={birthDay} onChange={(event) => setBirthDay(event.target.value)}><option value="">Dia</option>{dayOptions.map((day) => <option key={day} value={day}>{day}</option>)}</select><select aria-label="Mês" value={birthMonth} onChange={(event) => setBirthMonth(event.target.value)}><option value="">Mês</option>{MONTH_NAMES.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select><select aria-label="Ano" value={birthYear} onChange={(event) => setBirthYear(event.target.value)}><option value="">Ano</option>{yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}</select></div></label><label>Sexo (opcional)<select value={sex} onChange={(event) => setSex(event.target.value)}><option value="">Prefiro não informar</option><option value="female">Feminino</option><option value="male">Masculino</option><option value="other">Outro</option></select></label></div><Button disabled={saving}>{saving ? "SALVANDO..." : "SALVAR PERFIL"}</Button></form></Card>
    <Card><h2>Alterar senha</h2><p>Confirme sua senha atual para proteger a conta.</p><form onSubmit={savePassword}><label>Senha atual<input required name="currentPassword" type="password" autoComplete="current-password"/></label><label>Nova senha<input required minLength={6} name="newPassword" type="password" autoComplete="new-password"/></label><label>Confirmar nova senha<input required minLength={6} name="confirmPassword" type="password" autoComplete="new-password"/></label><Button disabled={passwordSaving}>{passwordSaving ? "ALTERANDO..." : "ALTERAR SENHA"}</Button></form></Card>
    <Button className="outline mobile-profile-logout" onClick={() => void logout()}>SAIR</Button>
  </AppShell>;
}

export default function Page() { return <Guard><Profile/></Guard>; }
