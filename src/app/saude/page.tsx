"use client";

import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/guard";
import { useAuth } from "@/components/providers";
import { Button, Card, Empty, ErrorState, Loading } from "@/components/ui";
import { AdministrationModal, type AdministrationSubmitValue, type AdministrationTarget } from "@/components/therapies/administration-modal";
import { TherapyForm, type TherapyFormValue } from "@/components/therapies/therapy-form";
import { buildTherapyIcs } from "@/lib/therapy-calendar-export";
import { calculateDueAdministrations, calculateNextAdministration, calculateOverdueAdministrations, type ScheduleWindow } from "@/lib/therapy-schedule";
import { dataErrorMessage, formatDateBR } from "@/lib/utils";
import { getNotificationPermission, requestNotificationPermission, showAppNotification } from "@/lib/notifications";
import { therapies as therapiesService, therapyAdministrations as administrationsService } from "@/services/therapies";
import type { AdministrationStatus, Therapy, TherapyAdministration } from "@/types";
import { Bell, BookOpen, CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STATUS_LABELS: Record<Therapy["status"], string> = { active: "Em andamento", paused: "Pausada", completed: "Concluída" };
const ADMINISTRATION_STATUS_LABELS: Record<AdministrationStatus, string> = { completed: "Registrada", skipped: "Pulada", postponed: "Adiada" };
const ICS_HORIZON_OPTIONS = [30, 90, 180];

interface DueEntry { therapy: Therapy; medicationId: string; medicationName: string; scheduledDate: string }

function medicationWindow(therapy: Therapy, medicationId: string): ScheduleWindow | null {
  const medication = therapy.medications.find((item) => item.id === medicationId);
  if (!medication) return null;
  return { startDate: therapy.startDate, endDate: therapy.endDate, continuous: therapy.continuous, schedule: medication.schedule };
}

function Health() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [therapyItems, setTherapyItems] = useState<Therapy[]>([]);
  const [administrations, setAdministrations] = useState<TherapyAdministration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Therapy | null>(null);
  const [target, setTarget] = useState<(AdministrationTarget & { therapyId: string; medicationId: string }) | null>(null);
  const [icsTherapyId, setIcsTherapyId] = useState<string | null>(null);
  const [notifyPermission, setNotifyPermission] = useState(() => getNotificationPermission());
  const notifiedRef = useRef(false);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError("");
    try {
      const [nextTherapies, nextAdministrations] = await Promise.all([therapiesService.list(uid), administrationsService.list(uid)]);
      setTherapyItems(nextTherapies);
      setAdministrations(nextAdministrations);
    } catch (reason) {
      setError(dataErrorMessage(reason, "Não foi possível carregar suas terapias."));
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const activeTherapies = useMemo(() => therapyItems.filter((item) => item.status === "active"), [therapyItems]);
  const logByMedication = useMemo(() => {
    const map = new Map<string, TherapyAdministration[]>();
    for (const item of administrations) map.set(item.medicationId, [...(map.get(item.medicationId) ?? []), item]);
    return map;
  }, [administrations]);

  const nextEntries = useMemo(() => activeTherapies.flatMap((therapy) => therapy.medications.map((medication) => {
    const scheduleWindow = medicationWindow(therapy, medication.id);
    if (!scheduleWindow) return null;
    const date = calculateNextAdministration(scheduleWindow, logByMedication.get(medication.id) ?? []);
    return date ? { therapy, medicationId: medication.id, medicationName: medication.name, scheduledDate: date } as DueEntry : null;
  }).filter((item): item is DueEntry => item !== null)).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)), [activeTherapies, logByMedication]);

  const overdueEntries = useMemo(() => activeTherapies.flatMap((therapy) => therapy.medications.flatMap((medication) => {
    const scheduleWindow = medicationWindow(therapy, medication.id);
    if (!scheduleWindow) return [];
    return calculateOverdueAdministrations(scheduleWindow, logByMedication.get(medication.id) ?? []).map((scheduledDate) => ({ therapy, medicationId: medication.id, medicationName: medication.name, scheduledDate }) as DueEntry);
  })).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)), [activeTherapies, logByMedication]);

  const dueTodayEntries = useMemo(() => activeTherapies.flatMap((therapy) => therapy.medications.flatMap((medication) => {
    const scheduleWindow = medicationWindow(therapy, medication.id);
    if (!scheduleWindow) return [];
    return calculateDueAdministrations(scheduleWindow, logByMedication.get(medication.id) ?? []).map((scheduledDate) => ({ therapy, medicationId: medication.id, medicationName: medication.name, scheduledDate }) as DueEntry);
  })), [activeTherapies, logByMedication]);

  useEffect(() => {
    if (notifiedRef.current || loading || notifyPermission !== "granted") return;
    const remindersToday = activeTherapies.flatMap((therapy) => therapy.medications.map((medication) => {
      if (therapy.reminderOffsetDays == null) return null;
      const scheduleWindow = medicationWindow(therapy, medication.id);
      if (!scheduleWindow) return null;
      const date = calculateNextAdministration(scheduleWindow, logByMedication.get(medication.id) ?? []);
      if (!date) return null;
      const remindDate = new Date(new Date(`${date}T12:00:00`).getTime() - therapy.reminderOffsetDays * 86400000).toISOString().slice(0, 10);
      return remindDate === new Date().toISOString().slice(0, 10) ? { medicationName: medication.name, date } : null;
    })).filter((item): item is { medicationName: string; date: string } => item !== null);
    const total = dueTodayEntries.length + remindersToday.length;
    if (total > 0) void showAppNotification("Saúde e terapias", { body: `${total} registro${total === 1 ? "" : "s"} previsto${total === 1 ? "" : "s"} para hoje.`, tag: "xtrainer-therapy" });
    notifiedRef.current = true;
  }, [loading, notifyPermission, activeTherapies, logByMedication, dueTodayEntries]);

  function openTarget(entry: DueEntry, action: AdministrationStatus) {
    setTarget({ therapyId: entry.therapy.id, medicationId: entry.medicationId, medicationName: entry.medicationName, scheduledDate: entry.scheduledDate, action });
  }

  async function submitAdministration(value: AdministrationSubmitValue) {
    if (!target || !uid) return;
    setSaving(true);
    try {
      await administrationsService.save({
        ownerId: uid,
        therapyId: target.therapyId,
        medicationId: target.medicationId,
        scheduledDate: target.scheduledDate,
        status: target.action,
        ...value,
      });
      setAdministrations(await administrationsService.list(uid));
      setTarget(null);
      setMessage("Registro salvo.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTherapy(value: TherapyFormValue) {
    setSaving(true);
    try {
      await therapiesService.save({ ownerId: uid!, ...value }, editing?.id);
      setTherapyItems(await therapiesService.list(uid!));
      setFormOpen(false);
      setEditing(null);
      setMessage(editing ? "Terapia atualizada." : "Terapia registrada.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTherapy(therapy: Therapy) {
    if (!confirm(`Excluir "${therapy.name}"? O histórico de registros relacionado será preservado, mas deixará de ser associado a uma terapia visível.`)) return;
    try {
      await therapiesService.remove(therapy.id);
      setTherapyItems(await therapiesService.list(uid!));
      setMessage("Terapia excluída.");
    } catch (reason) {
      setError(dataErrorMessage(reason, "Não foi possível excluir a terapia."));
    }
  }

  function downloadIcs(therapy: Therapy, horizonDays: number) {
    const ics = buildTherapyIcs(therapy, horizonDays);
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${therapy.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-calendario.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setIcsTherapyId(null);
  }

  async function enableNotifications() {
    setNotifyPermission(await requestNotificationPermission());
  }

  if (!uid) return <Loading/>;

  const historyRows = [...administrations].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  const medicationName = (row: TherapyAdministration) => therapyItems.find((item) => item.id === row.therapyId)?.medications.find((item) => item.id === row.medicationId)?.name ?? "Medicamento removido";
  const therapyName = (row: TherapyAdministration) => therapyItems.find((item) => item.id === row.therapyId)?.name ?? "Terapia removida";

  return <AppShell><header><p className="eyebrow">SAÚDE E TERAPIAS</p><h1>Suas terapias.</h1><p>Registro pessoal de medicamentos e terapias já prescritos ou informados por você.</p></header>
    <p className="muted">O XTrainer não prescreve medicamentos, não recomenda substâncias, não determina dose nem frequência. Você informa os dados; o app apenas organiza, lembra e registra.</p>
    <Link className="text-button" href="/referencia"><BookOpen size={15}/> Ver referência educativa de substâncias</Link>
    {message && <p className="success" role="status">{message}</p>}{error && <ErrorState message={error} onRetry={() => void load()}/>} {loading ? <Loading/> : <>
      {notifyPermission === "default" && <button type="button" className="text-button" onClick={() => void enableNotifications()}><Bell size={15}/> Ativar notificações de terapias</button>}

      <div className="actions page-actions"><Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={16}/> NOVA TERAPIA</Button></div>
      {formOpen && <Card><h2>{editing ? "Editar terapia" : "Registrar terapia"}</h2><TherapyForm initial={editing} saving={saving} onSave={saveTherapy} onCancel={() => { setFormOpen(false); setEditing(null); }}/></Card>}

      <Card><h2>Próxima administração</h2>{nextEntries[0] ? <div className="row"><div><strong>{nextEntries[0].medicationName}</strong><small>{nextEntries[0].therapy.name} · {formatDateBR(nextEntries[0].scheduledDate)}</small></div><div className="actions"><Button onClick={() => openTarget(nextEntries[0], "completed")}>CONFIRMAR</Button><button className="text-button" onClick={() => openTarget(nextEntries[0], "postponed")}>Adiar</button><button className="text-button" onClick={() => openTarget(nextEntries[0], "skipped")}>Pular</button></div></div> : <Empty title="Nenhuma próxima administração" detail="Registre uma terapia com frequência definida."/>}</Card>

      {overdueEntries.length > 0 && <Card><h2>Registros previstos não confirmados</h2>{overdueEntries.map((entry) => <div className="row" key={`${entry.medicationId}-${entry.scheduledDate}`}><div><strong>{entry.medicationName}</strong><small>{entry.therapy.name} · previsto para {formatDateBR(entry.scheduledDate)}</small></div><div className="actions"><Button onClick={() => openTarget(entry, "completed")}>CONFIRMAR</Button><button className="text-button" onClick={() => openTarget(entry, "postponed")}>Adiar</button><button className="text-button" onClick={() => openTarget(entry, "skipped")}>Pular</button></div></div>)}</Card>}

      <h2>Terapias</h2>
      <div className="cards">{therapyItems.map((therapy) => {
        const next = nextEntries.find((entry) => entry.therapy.id === therapy.id);
        return <Card key={therapy.id}><span className={`status-pill status-${therapy.status}`}>{STATUS_LABELS[therapy.status]}</span><h2>{therapy.name}</h2>
          <div className="detail-grid"><div><small>Início</small>{formatDateBR(therapy.startDate)}</div><div><small>Modo</small>{therapy.continuous ? "Contínuo" : therapy.endDate ? formatDateBR(therapy.endDate) : "—"}</div><div><small>Medicamentos</small>{therapy.medications.length}</div><div><small>Próxima</small>{next ? formatDateBR(next.scheduledDate) : "—"}</div></div>
          {therapy.notes && <p className="muted">{therapy.notes}</p>}
          <div className="actions"><button className="text-button" onClick={() => { setEditing(therapy); setFormOpen(true); }}><Pencil size={15}/> Editar</button><button className="text-button" onClick={() => setIcsTherapyId(therapy.id)}><CalendarDays size={15}/> Exportar calendário</button><button className="text-button danger-text" onClick={() => void removeTherapy(therapy)}><Trash2 size={15}/> Excluir</button></div>
          {icsTherapyId === therapy.id && <div className="ics-picker"><span>Horizonte:</span>{ICS_HORIZON_OPTIONS.map((days) => <button type="button" key={days} className="text-button" onClick={() => downloadIcs(therapy, days)}>{days} dias</button>)}<button type="button" className="text-button" onClick={() => setIcsTherapyId(null)}>Cancelar</button></div>}
        </Card>;
      })}</div>
      {!therapyItems.length && !formOpen && <Empty title="Nenhuma terapia registrada" detail="Use Nova terapia para registrar um tratamento já prescrito ou informado por você."/>}

      <Card><h2>Histórico</h2>{historyRows.length ? historyRows.map((row) => <div className="row" key={row.id}><div><strong>{medicationName(row)}</strong><small>{therapyName(row)} · previsto {formatDateBR(row.scheduledDate)}{row.actualDate ? ` · realizado ${formatDateBR(row.actualDate)}` : ""}</small>{row.notes && <p className="muted">{row.notes}</p>}</div><span className={`status-pill status-${row.status}`}>{ADMINISTRATION_STATUS_LABELS[row.status]}</span></div>) : <Empty title="Nenhum registro ainda" detail="O histórico aparece conforme você confirma, adia ou pula administrações."/>}</Card>
    </>}
    {target && <AdministrationModal target={target} saving={saving} onSubmit={submitAdministration} onClose={() => setTarget(null)}/>}
  </AppShell>;
}

export default function Page() { return <Guard><Health/></Guard>; }
