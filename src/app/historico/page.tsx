"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/guard";
import { useAuth } from "@/components/providers";
import { Button, Card, Empty, ErrorState, Loading } from "@/components/ui";
import { EXPORT_COLUMNS, buildExportRows, rowsToCsvText, sessionMatchesFilters, type ExportRow, type HistoryFilters } from "@/lib/history-export";
import { timestampDate } from "@/lib/training-analytics";
import { trainingStageLabel } from "@/lib/training-methods";
import { dataErrorMessage } from "@/lib/utils";
import { sessions, type SessionPage } from "@/services/data";
import type { WorkoutSession } from "@/types";

const dateLabel = (value: WorkoutSession["startedAt"]) => format(timestampDate(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
const timeLabel = (value: WorkoutSession["endedAt"]) => value ? format(timestampDate(value), "HH:mm", { locale: ptBR }) : "—";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportRowsToCsv(rows: ExportRow[]) {
  // BOM no início garante acentuação correta ao abrir o CSV no Excel.
  downloadBlob(new Blob([`﻿${rowsToCsvText(rows)}`], { type: "text/csv;charset=utf-8" }), `xtrainer-historico-${Date.now()}.csv`);
}

async function exportRowsToPdf(rows: ExportRow[]) {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new JsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("XTrainer — Histórico de treinos", 14, 16);
  doc.setFontSize(9);
  doc.text(`Exportado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · ${rows.length} séries`, 14, 22);
  autoTable(doc, {
    startY: 27,
    head: [EXPORT_COLUMNS.map(([, label]) => label)],
    body: rows.map((row) => EXPORT_COLUMNS.map(([key]) => row[key])),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [14, 165, 233] },
  });
  doc.save(`xtrainer-historico-${Date.now()}.pdf`);
}

function History() {
  const { user } = useAuth();
  const [data, setData] = useState<WorkoutSession[]>([]);
  const [cursor, setCursor] = useState<SessionPage["cursor"]>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("all");
  const [workout, setWorkout] = useState("");
  const [exercise, setExercise] = useState("");
  const [selected, setSelected] = useState<WorkoutSession | null>(null);
  const [referenceTime] = useState(() => Date.now());
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const load = useCallback(async (reset = false) => {
    if (!user) return;
    if (reset) setLoading(true);
    else setLoadingMore(true);
    setError("");
    try {
      const page = await sessions.listCompletedPage(user.uid, 20, reset ? null : cursor);
      setData((items) => reset ? page.items : [...items, ...page.items]);
      setCursor(page.cursor); setHasMore(page.hasMore);
    } catch (reason) { setError(dataErrorMessage(reason, "Não foi possível carregar o histórico.")); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [user, cursor]);

  useEffect(() => { if (user) void sessions.listCompletedPage(user.uid, 20).then((page) => { setData(page.items); setCursor(page.cursor); setHasMore(page.hasMore); }).catch((reason) => setError(dataErrorMessage(reason, "Não foi possível carregar o histórico."))).finally(() => setLoading(false)); }, [user]);
  const workoutNames = useMemo(() => [...new Set(data.map((item) => item.workoutName))].sort((a, b) => a.localeCompare(b, "pt-BR")), [data]);
  const activeFilters = useMemo<HistoryFilters>(() => ({ period, workout, exercise, referenceTime }), [period, workout, exercise, referenceTime]);
  const filtered = useMemo(() => data.filter((item) => sessionMatchesFilters(item, activeFilters)), [data, activeFilters]);

  async function exportHistory(kind: "csv" | "pdf") {
    if (!user) return;
    setExporting(kind);
    setError("");
    try {
      // Exporta o histórico completo (não só a página carregada na tela), respeitando os filtros ativos.
      const all = await sessions.listAllCompleted(user.uid);
      const rows = buildExportRows(all.filter((item) => sessionMatchesFilters(item, activeFilters)), dateLabel);
      if (!rows.length) { setError("Nenhuma sessão para exportar com os filtros atuais."); return; }
      if (kind === "csv") exportRowsToCsv(rows);
      else await exportRowsToPdf(rows);
    } catch (reason) {
      setError(dataErrorMessage(reason, "Não foi possível exportar o histórico."));
    } finally {
      setExporting(null);
    }
  }

  if (!user) return <Loading/>;
  return <AppShell>
    <header><p className="eyebrow">HISTÓRICO</p><h1>Cada sessão conta.</h1><p>Consulte métodos, etapas e resultados reais dos treinos concluídos.</p></header>
    <Card><div className="history-filters"><label>Período<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="30">30 dias</option><option value="90">90 dias</option><option value="180">6 meses</option><option value="365">1 ano</option><option value="all">Tudo carregado</option></select></label><label>Treino<select value={workout} onChange={(event) => setWorkout(event.target.value)}><option value="">Todos</option>{workoutNames.map((item) => <option key={item}>{item}</option>)}</select></label><label>Exercício<input value={exercise} onChange={(event) => setExercise(event.target.value)} placeholder="Pesquisar exercício"/></label></div>
      <div className="export-actions"><button type="button" className="text-button" disabled={exporting !== null} onClick={() => void exportHistory("csv")}><Download size={15}/> {exporting === "csv" ? "Exportando..." : "Exportar CSV"}</button><button type="button" className="text-button" disabled={exporting !== null} onClick={() => void exportHistory("pdf")}><FileText size={15}/> {exporting === "pdf" ? "Exportando..." : "Exportar PDF"}</button></div>
    </Card>
    {error && <ErrorState message={error} onRetry={() => void load(true)}/>} {loading ? <Loading/> : <Card><h2>Sessões concluídas</h2>{filtered.length ? filtered.map((item) => <div className="history-item" key={item.id}>
      <button className="history-summary" onClick={() => setSelected(selected?.id === item.id ? null : item)} aria-expanded={selected?.id === item.id}><span><strong>{item.workoutName}</strong><small>{dateLabel(item.startedAt)}</small></span><span>{item.totalSets} etapas · {Math.round(item.totalVolume).toLocaleString("pt-BR")} kg</span></button>
      {selected?.id === item.id && <div className="session-detail"><div className="detail-grid"><div><small>Início</small>{dateLabel(item.startedAt)}</div><div><small>Fim</small>{timeLabel(item.endedAt)}</div><div><small>Duração</small>{item.durationSeconds == null ? "—" : `${Math.round(item.durationSeconds / 60)} min`}</div><div><small>Volume</small>{Math.round(item.totalVolume).toLocaleString("pt-BR")} kg</div></div>
        {item.exercises.map((entry) => <section className="session-exercise" key={entry.id}><div className="actions"><h3>{entry.name} <span className="method-chip">{entry.target.methodSnapshot?.name ?? "Séries normais"}</span></h3>{entry.exerciseId && <Link className="text-button" href={`/evolucao?tab=exercicios&exerciseId=${encodeURIComponent(entry.exerciseId)}`}>Ver evolução deste exercício</Link>}</div>{entry.sets.filter((set) => set.completed).map((set) => <div className="set-history method-history-stage" key={set.id}><b>{trainingStageLabel(set)}</b><span>{set.load.toLocaleString("pt-BR")} kg</span><span>{set.durationSeconds !== undefined ? `${set.durationSeconds}s` : `${set.reps} reps`}</span><span>{Math.round(set.load * set.reps).toLocaleString("pt-BR")} kg</span>{set.rpe != null && <span>RPE {set.rpe}</span>}{set.rir != null && <span>RIR {set.rir}</span>}</div>)}</section>)}
      </div>}
    </div>) : <Empty title="Nenhuma sessão encontrada" detail="Ajuste os filtros ou finalize um treino."/>}{hasMore && <Button className="outline load-more" disabled={loadingMore} onClick={() => void load(false)}>{loadingMore ? "CARREGANDO..." : "CARREGAR MAIS"}</Button>}</Card>}
  </AppShell>;
}

export default function Page() { return <Guard><History/></Guard>; }
