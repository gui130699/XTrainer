"use client";

import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/guard";
import { useAuth } from "@/components/providers";
import { Card, Empty, ErrorState, Loading } from "@/components/ui";
import { calculateMonthlySummary, calculateYearlySummary, type MonthlyTrainingSummary, type YearlyTrainingSummary } from "@/lib/training-summaries";
import { timestampDate } from "@/lib/training-analytics";
import { dataErrorMessage } from "@/lib/utils";
import { exercises, sessions, weights } from "@/services/data";
import type { BodyWeight, Exercise, WorkoutSession } from "@/types";
import { ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const kg = (value: number) => `${Math.round(value).toLocaleString("pt-BR")} kg`;
const pct = (value: number | null) => value == null ? null : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

function ChangeChip({ value, neutralLabel }: { value: number | null; neutralLabel: string }) {
  if (value == null) return <span className="summary-change-chip is-neutral">{neutralLabel}</span>;
  return <span className={`summary-change-chip ${value >= 0 ? "is-positive" : "is-negative"}`}>{pct(value)}</span>;
}

function MonthlyView({ summary }: { summary: MonthlyTrainingSummary }) {
  return <>
    <div className="summary-hero-grid">
      <Card><span>TREINOS</span><strong>{summary.sessionsCount}</strong></Card>
      <Card><span>SÉRIES EFETIVAS</span><strong>{summary.effectiveSets}</strong></Card>
      <Card><span>VOLUME</span><strong>{kg(summary.volume)}</strong><ChangeChip value={summary.volumeChangePercent} neutralLabel="Sem comparação com o mês anterior."/></Card>
      <Card><span>DIAS TREINADOS</span><strong>{summary.trainedDays}</strong></Card>
      <Card><span>MÉDIA SEMANAL</span><strong>{summary.averageSessionsPerWeek.toFixed(1)}</strong></Card>
      <Card><span>DURAÇÃO MÉDIA</span><strong>{Math.round(summary.averageDurationSeconds / 60)} min</strong></Card>
    </div>
    <div className="split">
      <Card><h2>Recordes do mês</h2>{summary.newRecords.length ? <><p className="muted">{summary.newRecords.length} novo{summary.newRecords.length === 1 ? "" : "s"} recorde{summary.newRecords.length === 1 ? "" : "s"}.</p>{summary.newRecords.slice(0, 6).map((event, index) => <div className="row" key={`${event.exerciseId}-${event.kind}-${index}`}><strong>{event.name}</strong><span>{event.kind === "load" ? `${event.value.toLocaleString("pt-BR")} kg` : event.kind === "reps" ? `${event.value} repetições` : `${Math.round(event.value).toLocaleString("pt-BR")} kg de volume`}</span></div>)}</> : <Empty title="Nenhum recorde novo" detail="Continue treinando para aparecer aqui."/>}</Card>
      <Card><h2>Destaques</h2>
        <div className="detail-grid">
          <div><small>Mais treinado</small>{summary.topMuscleGroup?.muscleGroup ?? "—"}</div>
          <div><small>Exercício nº 1</small>{summary.topExercise ? `${summary.topExercise.name} (${summary.topExercise.sessionsCount})` : "—"}</div>
          <div><small>Método mais usado</small>{summary.topMethod ? `${summary.topMethod.methodName} (${summary.topMethod.uses}x)` : "—"}</div>
          <div><small>Frequência vs mês anterior</small>{summary.frequencyChangePercent == null ? "Sem comparação" : pct(summary.frequencyChangePercent)}</div>
        </div>
      </Card>
    </div>
    {summary.weight && <Card><h2>Peso no período</h2><div className="detail-grid"><div><small>Início</small>{summary.weight.start.toLocaleString("pt-BR")} kg</div><div><small>Fim</small>{summary.weight.end.toLocaleString("pt-BR")} kg</div><div><small>Variação</small>{summary.weight.change >= 0 ? "+" : ""}{summary.weight.change.toLocaleString("pt-BR")} kg</div></div></Card>}
  </>;
}

function shareSummaryText(summary: YearlyTrainingSummary) {
  const lines = [
    `Meu ${summary.year} no XTrainer`,
    `${summary.sessionsCount} treinos · ${summary.effectiveSets} séries efetivas`,
    `${kg(summary.volume)} de volume total`,
    summary.newRecords.length ? `${summary.newRecords.length} novos recordes` : null,
    summary.topExercise ? `Exercício nº 1: ${summary.topExercise.name}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

async function shareSummary(summary: YearlyTrainingSummary, onFallback: (message: string) => void) {
  const text = shareSummaryText(summary);
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try { await navigator.share({ text, title: "XTrainer" }); return; } catch { /* usuário cancelou ou share indisponível; cai no fallback */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    onFallback("Resumo copiado para a área de transferência.");
  } catch {
    onFallback("Não foi possível compartilhar automaticamente. Copie o resumo manualmente.");
  }
}

function WrappedExperience({ summary }: { summary: YearlyTrainingSummary }) {
  const [started, setStarted] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  if (summary.sessionsCount === 0) return <Card><Empty title={`Você ainda não possui treinos concluídos em ${summary.year}.`} detail="Finalize um treino para começar a construir seu resumo anual."/></Card>;

  const slides = [
    <div className="wrapped-slide" key="intro"><span className="wrapped-kicker">XTRAINER</span><strong className="wrapped-value">SEU {summary.year}</strong></div>,
    <div className="wrapped-slide" key="sessions"><strong className="wrapped-value">{summary.sessionsCount}</strong><span className="wrapped-label">TREINOS</span><p className="wrapped-detail">Você apareceu. E apareceu de novo.</p></div>,
    <div className="wrapped-slide" key="volume"><strong className="wrapped-value">{kg(summary.volume)}</strong><span className="wrapped-label">DE VOLUME TOTAL</span></div>,
    ...(summary.topMuscleGroup ? [<div className="wrapped-slide" key="muscle"><strong className="wrapped-value">{summary.topMuscleGroup.muscleGroup.toUpperCase()}</strong><span className="wrapped-label">SEU GRUPO MAIS TREINADO</span></div>] : []),
    ...(summary.topExercise ? [<div className="wrapped-slide" key="exercise"><strong className="wrapped-value">{summary.topExercise.name}</strong><span className="wrapped-label">{summary.topExercise.sessionsCount} sessões · SEU EXERCÍCIO Nº 1</span></div>] : []),
    <div className="wrapped-slide" key="records"><strong className="wrapped-value">{summary.newRecords.length}</strong><span className="wrapped-label">NOVOS RECORDES</span></div>,
    ...(summary.biggestAbsoluteGain ? [<div className="wrapped-slide" key="gain"><span className="wrapped-kicker">{summary.biggestAbsoluteGain.name}</span><strong className="wrapped-value">{summary.biggestAbsoluteGain.first}→{summary.biggestAbsoluteGain.last}</strong><span className="wrapped-label">{summary.biggestAbsoluteGain.percentage != null ? `${summary.biggestAbsoluteGain.percentage >= 0 ? "+" : ""}${summary.biggestAbsoluteGain.percentage.toFixed(1)}%` : `${summary.biggestAbsoluteGain.absolute >= 0 ? "+" : ""}${summary.biggestAbsoluteGain.absolute} kg`}</span></div>] : []),
    ...(summary.topMethod ? [<div className="wrapped-slide" key="method"><strong className="wrapped-value">{summary.topMethod.methodName}</strong><span className="wrapped-label">SEU MÉTODO ESPECIAL MAIS USADO</span></div>] : []),
    <div className="wrapped-slide" key="final">
      <span className="wrapped-kicker">SEU {summary.year}</span>
      <div className="wrapped-final-list">
        <div><span>Treinos</span><b>{summary.sessionsCount}</b></div>
        <div><span>Séries efetivas</span><b>{summary.effectiveSets}</b></div>
        <div><span>Recordes</span><b>{summary.newRecords.length}</b></div>
        <div><span>Volume</span><b>{kg(summary.volume)}</b></div>
      </div>
      <button type="button" className="button" onClick={() => void shareSummary(summary, setShareMessage)}><Share2 size={16}/> COMPARTILHAR RESUMO</button>
      {shareMessage && <p className="success" role="status">{shareMessage}</p>}
    </div>,
  ];

  if (!started) return <Card className="wrapped-shell"><div className="wrapped-slide"><span className="wrapped-kicker">XTRAINER</span><strong className="wrapped-value">SEU {summary.year}</strong><button type="button" className="button" onClick={() => setStarted(true)}>COMEÇAR</button><button type="button" className="text-button" onClick={() => setDetailsOpen((value) => !value)}>{detailsOpen ? "Ocultar detalhes" : "Ver detalhes"}</button></div>{detailsOpen && <YearlyDetails summary={summary}/>}</Card>;

  return <Card className="wrapped-shell">
    {slides[slideIndex]}
    <div className="wrapped-dots">{slides.map((_, index) => <span key={index} className={index === slideIndex ? "is-active" : ""}/>)}</div>
    <div className="wrapped-nav">
      <button type="button" className="text-button" onClick={() => setSlideIndex((value) => Math.max(0, value - 1))} disabled={slideIndex === 0}><ChevronLeft size={16}/> Anterior</button>
      {slideIndex < slides.length - 1
        ? <button type="button" className="button" onClick={() => setSlideIndex((value) => Math.min(slides.length - 1, value + 1))}>PRÓXIMO <ChevronRight size={16}/></button>
        : <button type="button" className="text-button" onClick={() => setStarted(false)}>Voltar ao início</button>}
    </div>
  </Card>;
}

function YearlyDetails({ summary }: { summary: YearlyTrainingSummary }) {
  return <>
    <div className="summary-hero-grid">
      <Card><span>TREINOS</span><strong>{summary.sessionsCount}</strong></Card>
      <Card><span>SÉRIES EFETIVAS</span><strong>{summary.effectiveSets}</strong></Card>
      <Card><span>VOLUME</span><strong>{kg(summary.volume)}</strong></Card>
      <Card><span>DIAS TREINADOS</span><strong>{summary.trainedDays}</strong></Card>
      <Card><span>MAIOR SEQUÊNCIA</span><strong>{summary.longestStreakWeeks} sem.</strong></Card>
      <Card><span>TREINOS DIFERENTES</span><strong>{summary.distinctWorkouts}</strong></Card>
    </div>
    <div className="split">
      <Card><h2>Distribuição por grupo muscular</h2>{summary.muscleGroupDistribution.slice(0, 8).map((item) => <div className="row" key={item.muscleGroup}><span>{item.muscleGroup}</span><strong>{item.effectiveSets}</strong></div>)}</Card>
      <Card><h2>Top exercícios</h2>{summary.topExercises.map((item) => <div className="row" key={item.exerciseId}><span>{item.name}</span><strong>{item.sessionsCount} sessões</strong></div>)}{!summary.topExercises.length && <Empty title="Sem dados" detail="Nenhum exercício executado neste ano."/>}</Card>
    </div>
    <div className="split">
      <Card><h2>Melhor mês</h2><div className="detail-grid"><div><small>Mais treinos</small>{summary.bestMonth ? `${MONTH_NAMES[summary.bestMonth.month]} (${summary.bestMonth.sessionsCount})` : "—"}</div><div><small>Mais volume</small>{summary.bestVolumeMonth ? `${MONTH_NAMES[summary.bestVolumeMonth.month]} (${kg(summary.bestVolumeMonth.volume)})` : "—"}</div></div></Card>
      <Card><h2>Evolução de carga</h2><div className="detail-grid"><div><small>Maior ganho absoluto</small>{summary.biggestAbsoluteGain ? `${summary.biggestAbsoluteGain.name}: ${summary.biggestAbsoluteGain.absolute >= 0 ? "+" : ""}${summary.biggestAbsoluteGain.absolute} kg` : "—"}</div><div><small>Maior ganho percentual</small>{summary.biggestPercentageGain?.percentage != null ? `${summary.biggestPercentageGain.name}: ${summary.biggestPercentageGain.percentage >= 0 ? "+" : ""}${summary.biggestPercentageGain.percentage.toFixed(1)}%` : "—"}</div></div></Card>
    </div>
    {summary.weight && <Card><h2>Peso no ano</h2><div className="detail-grid"><div><small>Início</small>{summary.weight.start.toLocaleString("pt-BR")} kg</div><div><small>Fim</small>{summary.weight.end.toLocaleString("pt-BR")} kg</div><div><small>Variação</small>{summary.weight.change >= 0 ? "+" : ""}{summary.weight.change.toLocaleString("pt-BR")} kg</div></div></Card>}
  </>;
}

function Summaries() {
  const { user } = useAuth();
  const [allSessions, setAllSessions] = useState<WorkoutSession[]>([]);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [bodyWeights, setBodyWeights] = useState<BodyWeight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"mensal" | "anual">("mensal");
  const [monthDate, setMonthDate] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [year, setYear] = useState(() => new Date().getFullYear());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [sessionsResult, libraryResult, weightsResult] = await Promise.all([sessions.listAllCompleted(user.uid), exercises.list(), weights.list(user.uid)]);
      setAllSessions(sessionsResult);
      setLibrary(libraryResult);
      setBodyWeights(weightsResult);
    } catch (reason) {
      setError(dataErrorMessage(reason, "Não foi possível carregar seus resumos."));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const parameters = new URLSearchParams(window.location.search);
      const requestedTab = parameters.get("tab");
      if (requestedTab === "mensal" || requestedTab === "anual") setTab(requestedTab);
      const month = parameters.get("month");
      if (month && /^\d{4}-\d{2}$/.test(month)) { const [y, m] = month.split("-").map(Number); setMonthDate(new Date(y, m - 1, 1)); }
      const requestedYear = parameters.get("year");
      if (requestedYear && /^\d{4}$/.test(requestedYear)) setYear(Number(requestedYear));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function syncUrl(nextTab: "mensal" | "anual", nextMonth: Date, nextYear: number) {
    const params = new URLSearchParams();
    params.set("tab", nextTab);
    if (nextTab === "mensal") params.set("month", `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`);
    else params.set("year", String(nextYear));
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  function changeMonth(direction: -1 | 1) {
    const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + direction, 1);
    setMonthDate(next);
    syncUrl("mensal", next, year);
  }

  function changeYear(direction: -1 | 1) {
    const next = year + direction;
    setYear(next);
    syncUrl("anual", monthDate, next);
  }

  function changeTab(next: "mensal" | "anual") {
    setTab(next);
    syncUrl(next, monthDate, year);
  }

  const monthlySummary = useMemo(() => {
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
    const previousStart = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
    const currentSessions = allSessions.filter((item) => { const time = timestampDate(item.startedAt).getTime(); return time >= monthStart.getTime() && time < monthEnd.getTime(); });
    const previousSessions = allSessions.filter((item) => { const time = timestampDate(item.startedAt).getTime(); return time >= previousStart.getTime() && time < monthStart.getTime(); });
    const recordBaselineSessions = allSessions.filter((item) => timestampDate(item.startedAt).getTime() < monthEnd.getTime());
    return calculateMonthlySummary({ year: monthDate.getFullYear(), month: monthDate.getMonth(), currentSessions, previousSessions, recordBaselineSessions, library, weights: bodyWeights });
  }, [allSessions, library, bodyWeights, monthDate]);

  const yearlySummary = useMemo(() => {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);
    const currentSessions = allSessions.filter((item) => { const time = timestampDate(item.startedAt).getTime(); return time >= yearStart.getTime() && time < yearEnd.getTime(); });
    const recordBaselineSessions = allSessions.filter((item) => timestampDate(item.startedAt).getTime() < yearEnd.getTime());
    return calculateYearlySummary({ year, currentSessions, recordBaselineSessions, library, weights: bodyWeights });
  }, [allSessions, library, bodyWeights, year]);

  const monthLabel = `${MONTH_NAMES[monthDate.getMonth()]} de ${monthDate.getFullYear()}`;

  if (!user) return <Loading/>;
  return <AppShell><header><p className="eyebrow">RESUMOS</p><h1>Seu progresso, em números.</h1><p>Baseado exclusivamente em treinos concluídos.</p></header>
    <nav className="summary-tabs"><button type="button" className={tab === "mensal" ? "active" : ""} onClick={() => changeTab("mensal")}>Mensal</button><button type="button" className={tab === "anual" ? "active" : ""} onClick={() => changeTab("anual")}>Anual · Wrapped</button></nav>
    {error && <ErrorState message={error} onRetry={() => void load()}/>} {loading ? <Loading/> : <>
      {tab === "mensal" ? <>
        <div className="summary-period-nav"><button type="button" className="icon-button" onClick={() => changeMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={18}/></button><strong>{monthLabel}</strong><button type="button" className="icon-button" onClick={() => changeMonth(1)} aria-label="Próximo mês"><ChevronRight size={18}/></button></div>
        <MonthlyView summary={monthlySummary}/>
      </> : <>
        <div className="summary-period-nav"><button type="button" className="icon-button" onClick={() => changeYear(-1)} aria-label="Ano anterior"><ChevronLeft size={18}/></button><strong>{year}</strong><button type="button" className="icon-button" onClick={() => changeYear(1)} aria-label="Próximo ano"><ChevronRight size={18}/></button></div>
        <WrappedExperience summary={yearlySummary}/>
      </>}
    </>}
  </AppShell>;
}

export default function Page() { return <Guard><Summaries/></Guard>; }
