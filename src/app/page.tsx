"use client";

import Link from "next/link";
import { Dumbbell, Flame, Play, Scale, TrendingUp, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/guard";
import { useAuth } from "@/components/providers";
import { Card, Empty, ErrorState, Loading, MetricCard } from "@/components/ui";
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

  const heroSubtitle = nextPlan?.muscleGroups?.length ? nextPlan.muscleGroups.join(" + ") : nextPlan?.description;
  return <AppShell><header><p className="eyebrow">PAINEL PESSOAL</p><h1>Olá, {firstName}.</h1><p className="header-date"><button type="button" className="header-date-button" onClick={openCalendar}>{today}</button></p></header>
    {error && <ErrorState message={error} onRetry={() => void load()}/>} {loading ? <Loading/> : <>
      <Card className="hero hero-next-workout"><div className="hero-content"><span>PRÓXIMO TREINO</span>{nextPlan ? <><h2>{heroSubtitle || nextPlan.title}</h2><p className="hero-detail">{nextPlan.title !== heroSubtitle ? `${nextPlan.title} · ` : ""}{nextPlan.exercises.length} exercício{nextPlan.exercises.length === 1 ? "" : "s"}</p></> : <><h2>Nenhum treino programado</h2><p className="hero-detail">Crie seu primeiro treino na aba Treino.</p></>}</div><Link className="button hero-cta" href="/treino"><Play size={18}/> {nextPlan ? "INICIAR TREINO" : "CRIAR TREINO"}</Link></Card>
      <div className="stat-grid">
        <MetricCard icon={Dumbbell} label="Treinos no mês" value={month.workouts}/>
        <MetricCard icon={TrendingUp} label="Volume do mês" value={`${Math.round(month.volume).toLocaleString("pt-BR")} kg`}/>
        <MetricCard icon={Scale} label="Peso atual" value={body.length ? kg(body.at(-1)!.weight) : "—"}/>
        <MetricCard icon={Flame} label="Sequência semanal" value={streak} detail={streak === 1 ? "semana" : "semanas"}/>
      </div>
      <div className="split"><Card><h3>Últimos treinos</h3>{recent.length ? recent.slice(0, 4).map((item) => <div className="row" key={item.id}><span>{item.workoutName}</span><small>{item.totalSets} séries · {Math.round(item.totalVolume).toLocaleString("pt-BR")} kg</small></div>) : <Empty title="Ainda sem treino" detail="Sua primeira sessão concluída aparecerá aqui."/>}</Card>
      <Card><h3><Trophy size={18}/> Recordes recentes</h3>{records.length ? records.map((record) => <div className="row" key={record.exerciseId}><span>{record.name}</span><small>{record.maxLoad.toLocaleString("pt-BR")} kg · {record.bestSet.reps} reps</small></div>) : <Empty title="Nenhum recorde registrado ainda" detail="Os recordes são calculados automaticamente ao finalizar séries."/>}</Card></div>
      <Card className="month-summary-card"><div className="month-summary-head"><span>SEU MÊS</span><Link className="text-button" href="/resumos?tab=mensal">Ver resumo completo →</Link></div><div className="month-summary-stats"><div><strong>{month.sets}</strong><small>séries efetivas</small></div><div><strong>{monthNewRecords}</strong><small>{monthNewRecords === 1 ? "novo recorde" : "novos recordes"}</small></div></div></Card>
    </>}
    {calendarOpen && <TrainingCalendar month={calendarMonth} sessions={calendarSessions} loading={calendarLoading} onPrevMonth={() => changeCalendarMonth(-1)} onNextMonth={() => changeCalendarMonth(1)} onClose={() => setCalendarOpen(false)}/>}
  </AppShell>;
}

export default function Home() { return <Guard><Dashboard/></Guard>; }
