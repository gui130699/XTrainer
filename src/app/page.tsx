"use client";

import Link from "next/link";
import { Play, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/guard";
import { useAuth } from "@/components/providers";
import { Card, Empty, ErrorState, Loading } from "@/components/ui";
import { TrainingCalendar } from "@/components/training-calendar";
import { calculateExerciseRecords, calculateMonthlyStats, calculateTrainingStreak } from "@/lib/training-analytics";
import { buildRecordTimeline } from "@/lib/training-summaries";
import { dataErrorMessage } from "@/lib/utils";
import { kg } from "@/lib/utils";
import { sessions, weights, workouts } from "@/services/data";
import type { BodyWeight, Workout, WorkoutSession } from "@/types";
import { useCallback, useEffect, useMemo, useState } from "react";

function Dashboard() {
  const { user, profile } = useAuth();
  const today = useMemo(() => {
    const formatted = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, []);
  const [recent, setRecent] = useState<WorkoutSession[]>([]);
  const [monthSessions, setMonthSessions] = useState<WorkoutSession[]>([]);
  const [plans, setPlans] = useState<Workout[]>([]);
  const [body, setBody] = useState<BodyWeight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [calendarSessions, setCalendarSessions] = useState<WorkoutSession[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    try {
      const [recentPage, currentMonth, nextPlans, nextWeights] = await Promise.all([
        sessions.listCompletedPage(user.uid, 100),
        sessions.listCompletedBetween(user.uid, monthStart, nextMonth),
        workouts.list(user.uid),
        weights.list(user.uid),
      ]);
      setRecent(recentPage.items);
      setMonthSessions(currentMonth);
      setPlans(nextPlans);
      setBody(nextWeights);
    } catch (reason) {
      setError(dataErrorMessage(reason, "Verifique sua conexão e tente novamente."));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function loadCalendarMonth(monthStart: Date) {
    if (!user) return;
    setCalendarLoading(true);
    try {
      const nextMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
      setCalendarSessions(await sessions.listCompletedBetween(user.uid, monthStart, nextMonthStart));
    } catch {
      setCalendarSessions([]);
    } finally {
      setCalendarLoading(false);
    }
  }

  function openCalendar() {
    setCalendarOpen(true);
    void loadCalendarMonth(calendarMonth);
  }

  function changeCalendarMonth(direction: -1 | 1) {
    const next = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + direction, 1);
    setCalendarMonth(next);
    void loadCalendarMonth(next);
  }

  if (!user) return <Loading/>;
  const firstName = (profile?.name || user.displayName || user.email?.split("@")[0] || "atleta").trim().split(" ")[0];
  const month = calculateMonthlyStats(monthSessions);
  const streak = calculateTrainingStreak(recent);
  const records = [...calculateExerciseRecords(recent).values()].sort((a, b) => b.maxLoadDate.getTime() - a.maxLoadDate.getTime()).slice(0, 4);
  const nextPlan = plans.find((item) => item.active);
  const now = new Date();
  const monthStartMillis = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEndMillis = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  // Aproximação leve baseada nas últimas 100 sessões já carregadas no painel; o cálculo
  // completo e exato do mês (com histórico total como base de recorde) fica em /resumos.
  const monthNewRecords = buildRecordTimeline(recent).filter((event) => event.date.getTime() >= monthStartMillis && event.date.getTime() < monthEndMillis).length;

  return <AppShell><header><p className="eyebrow">PAINEL PESSOAL</p><h1>Olá, {firstName}.</h1><p>Seu foco constrói sua evolução.</p><p className="header-date"><button type="button" className="header-date-button" onClick={openCalendar}>{today}</button></p></header>
    {error && <ErrorState message={error} onRetry={() => void load()}/>} {loading ? <Loading/> : <>
      <Card className="hero"><div><span>PRÓXIMO TREINO</span><h2>{nextPlan?.title || "Nenhum treino programado"}</h2><p>{nextPlan?.description || "Crie seu primeiro treino na aba Treino."}</p></div><Link className="button" href="/treino"><Play size={18}/> ABRIR TREINOS</Link></Card>
      <div className="stat-grid"><Card><span>Treinos no mês</span><strong>{month.workouts}</strong></Card><Card><span>Volume do mês</span><strong>{Math.round(month.volume).toLocaleString("pt-BR")} kg</strong></Card><Card><span>Peso atual</span><strong>{body.length ? kg(body.at(-1)!.weight) : "—"}</strong></Card><Card><span>Sequência semanal</span><strong>{streak} {streak === 1 ? "semana" : "semanas"}</strong></Card></div>
      <div className="split"><Card><h3>Últimos treinos</h3>{recent.length ? recent.slice(0, 4).map((item) => <div className="row" key={item.id}><span>{item.workoutName}</span><small>{item.totalSets} séries · {Math.round(item.totalVolume).toLocaleString("pt-BR")} kg</small></div>) : <Empty title="Ainda sem treino" detail="Sua primeira sessão concluída aparecerá aqui."/>}</Card>
      <Card><h3><Trophy size={18}/> Recordes recentes</h3>{records.length ? records.map((record) => <div className="row" key={record.exerciseId}><span>{record.name}</span><small>{record.maxLoad.toLocaleString("pt-BR")} kg · {record.bestSet.reps} reps</small></div>) : <Empty title="Nenhum recorde registrado ainda" detail="Os recordes são calculados automaticamente ao finalizar séries."/>}</Card></div>
      <Card><span>SEU MÊS</span><div className="stat-grid"><div><strong>{month.workouts}</strong><small>treinos</small></div><div><strong>{month.sets}</strong><small>séries</small></div><div><strong>{monthNewRecords}</strong><small>PRs</small></div></div><Link className="button outline" href="/resumos?tab=mensal">VER RESUMO</Link></Card>
    </>}
    {calendarOpen && <TrainingCalendar month={calendarMonth} sessions={calendarSessions} loading={calendarLoading} onPrevMonth={() => changeCalendarMonth(-1)} onNextMonth={() => changeCalendarMonth(1)} onClose={() => setCalendarOpen(false)}/>}
  </AppShell>;
}

export default function Home() { return <Guard><Dashboard/></Guard>; }
