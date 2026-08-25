"use client";

import { AlertDialog } from "@/components/alert-dialog";
import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/guard";
import { useAuth } from "@/components/providers";
import { Button, Card } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { changePassword, friendlyAuthError, logout, signOutAndClearDevice, updateProfile } from "@/services/auth";
import { useEffect, useState } from "react";

const SEX_LABELS: Record<string, string> = { female: "Feminino", male: "Masculino", other: "Outro" };
const TODAY_ISO = new Date().toISOString().slice(0, 10);
const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("") || "?";

function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [height, setHeight] = useState("");
  const [goal, setGoal] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [confirmingWipe, setConfirmingWipe] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setName(profile?.name ?? "");
      setHeight(profile?.height?.toString() ?? "");
      setGoal(profile?.goal ?? "");
      setBirthDate(profile?.birthDate ?? "");
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
      await updateProfile(user!.uid, {
        name: normalizedName,
        height: parsedHeight,
        goal: goal.trim() || undefined,
        birthDate: birthDate || undefined,
        sex: sex || undefined,
      });
      await refreshProfile();
      setMessage("Perfil atualizado. As alterações já estão visíveis no aplicativo.");
    } catch (reason) {
      const code = typeof reason === "object" && reason !== null && "code" in reason ? String((reason as { code: unknown }).code) : null;
      console.error("Falha ao salvar o perfil:", reason);
      setError(code === "permission-denied"
        ? "Não foi possível salvar seu perfil. Sua sessão está ativa, mas o Firestore recusou a gravação. Tente novamente em instantes."
        : friendlyAuthError(reason));
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

  const displayName = profile?.name || user.displayName || "Seu perfil";
  const detailParts = [profile?.height ? `${profile.height} cm` : null, profile?.sex ? SEX_LABELS[profile.sex] ?? profile.sex : null].filter(Boolean);

  return <AppShell><header><p className="eyebrow">PERFIL</p>
    <div className="profile-heading">
      <span className="profile-avatar" aria-hidden="true">{initials(displayName)}</span>
      <div><h1>{displayName}</h1>{profile?.goal && <p className="profile-goal">{profile.goal}</p>}<p className="caption">{user.email}{detailParts.length > 0 ? ` • ${detailParts.join(" • ")}` : ""}</p></div>
    </div>
  </header>
    {message && <p className="success" role="status">{message}</p>}{error && <p className="error" role="alert">{error}</p>}
    <Card><h2>Dados pessoais</h2><p>Informações corporais são opcionais e privadas.</p><form onSubmit={save}><div className="form-grid"><label>Nome<input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name"/></label><label>Altura (cm)<input value={height} onChange={(event) => setHeight(event.target.value)} type="number" min="1" max="300" step="0.1" inputMode="decimal"/></label><label>Data de nascimento<input value={birthDate} onChange={(event) => setBirthDate(event.target.value)} type="date" max={TODAY_ISO}/></label><label>Sexo (opcional)<select value={sex} onChange={(event) => setSex(event.target.value)}><option value="">Prefiro não informar</option><option value="female">Feminino</option><option value="male">Masculino</option><option value="other">Outro</option></select></label><label className="span-full">Objetivo<input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Ex.: hipertrofia"/></label></div><div className="profile-form-actions"><Button disabled={saving}>{saving ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}</Button></div></form></Card>
    <Card><h2>Segurança</h2><p>Confirme sua senha atual para proteger a conta.</p><form onSubmit={savePassword}><label>Senha atual<input required name="currentPassword" type="password" autoComplete="current-password"/></label><label>Nova senha<input required minLength={6} name="newPassword" type="password" autoComplete="new-password"/></label><label>Confirmar nova senha<input required minLength={6} name="confirmPassword" type="password" autoComplete="new-password"/></label><div className="profile-form-actions"><Button disabled={passwordSaving}>{passwordSaving ? "ALTERANDO..." : "ALTERAR SENHA"}</Button></div></form></Card>
    <Card><h2>Preferências</h2><p>Ajustes de exibição do aplicativo, salvos apenas neste dispositivo.</p><div className="profile-preference-row"><span>Tema</span><ThemeToggle/></div></Card>
    <div className="profile-logout-actions">
      <Button className="outline mobile-profile-logout" onClick={() => void logout()}>SAIR</Button>
      <button type="button" className="text-button" onClick={() => setConfirmingWipe(true)}>Sair e limpar dados deste dispositivo</button>
    </div>
    {confirmingWipe && <AlertDialog eyebrow="LIMPAR DISPOSITIVO" title="Sair e limpar dados deste dispositivo?" message="Isso vai sair da conta e apagar treinos, avaliações e preferências salvos offline NESTE dispositivo (nada é apagado da sua conta)." confirmLabel="SAIR E LIMPAR" onConfirm={() => void signOutAndClearDevice()} onCancel={() => setConfirmingWipe(false)}/>}
  </AppShell>;
}

export default function Page() { return <Guard><Profile/></Guard>; }
