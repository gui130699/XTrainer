"use client";

import dynamic from "next/dynamic";
import { AppShell } from "@/components/app-shell";
import { AssessmentForm, BODY_MEASUREMENT_LABELS, type AssessmentFormValue } from "@/components/assessment-form";
import { Guard } from "@/components/guard";
import { useAuth } from "@/components/providers";
import { Button, Card, Empty, ErrorState, Loading } from "@/components/ui";
import { compareAssessments } from "@/lib/body-assessments";
import { calculateEvolution, calculateExerciseHistory, calculateExerciseRecords, calculateMonthlyStats } from "@/lib/training-analytics";
import { dataErrorMessage, exerciseMuscleGroups, formatDateBR, normalizeSearchText, parseBrazilianNumber } from "@/lib/utils";
import { assessments, exercises, sessions, weights, type SessionPage } from "@/services/data";
import type { AssessmentPhotoView, AssessmentType, BodyWeight, Exercise, PhysicalAssessment, WorkoutSession } from "@/types";
import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const EvolutionChart = dynamic(() => import("@/components/evolution-chart").then((module) => module.EvolutionChart), { ssr: false, loading: () => <div className="chart-placeholder">Carregando gráfico...</div> });
type Tab = "resumo" | "peso" | "avaliacoes" | "medidas" | "avancada" | "exercicios";
const tabs: [Tab, string][] = [["resumo", "Resumo"], ["peso", "Peso"], ["avaliacoes", "Avaliações"], ["medidas", "Medidas"], ["avancada", "Avançada"], ["exercicios", "Exercícios"]];

const periodDays: Record<string, number> = { "30": 30, "90": 90, "180": 180, "365": 365 };
const filterByPeriod = <T extends { date: string }>(items: T[], period: string) => period === "all" ? items : items.filter((item) => new Date(`${item.date}T12:00:00`).getTime() >= Date.now() - periodDays[period] * 86400000);

function Evolution() {
  const { user, profile } = useAuth();
  const uid = user?.uid;
  const [tab, setTab] = useState<Tab>("resumo");
  const [body, setBody] = useState<BodyWeight[]>([]);
  const [assessmentItems, setAssessmentItems] = useState<PhysicalAssessment[]>([]);
  const [training, setTraining] = useState<WorkoutSession[]>([]);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [sessionCursor, setSessionCursor] = useState<SessionPage["cursor"]>(null);
  const [hasMoreSessions, setHasMoreSessions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [period, setPeriod] = useState("all");
  const [weightFormOpen, setWeightFormOpen] = useState(false);
  const [editingWeight, setEditingWeight] = useState<BodyWeight | null>(null);
  const [editingAssessment, setEditingAssessment] = useState<PhysicalAssessment | null>(null);
  const [assessmentFormOpen, setAssessmentFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [measureKey, setMeasureKey] = useState("waist");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseGroup, setExerciseGroup] = useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [exerciseMetric, setExerciseMetric] = useState<"maxLoad" | "totalVolume" | "totalReps" | "bestSet">("maxLoad");
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError("");
    try {
      const [nextWeights, nextAssessments, sessionPage, nextLibrary] = await Promise.all([weights.list(uid), assessments.list(uid), sessions.listCompletedPage(uid, 100), exercises.list()]);
      setBody(nextWeights);
      setAssessmentItems(nextAssessments);
      setTraining(sessionPage.items);
      setSessionCursor(sessionPage.cursor);
      setHasMoreSessions(sessionPage.hasMore);
      if (nextAssessments.length > 1) {
        setCompareA((value) => value || nextAssessments.at(-1)!.id);
        setCompareB((value) => value || nextAssessments[0].id);
      }
      setLibrary(nextLibrary);
    } catch (reason) {
      setError(dataErrorMessage(reason, "Não foi possível carregar sua evolução."));
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const parameters = new URLSearchParams(window.location.search);
      const requestedTab = parameters.get("tab") as Tab | null;
      if (requestedTab && tabs.some(([value]) => value === requestedTab)) setTab(requestedTab);
      const exerciseId = parameters.get("exerciseId");
      if (exerciseId) setSelectedExerciseId(exerciseId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const sortedWeights = useMemo(() => [...body].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)), [body]);
  const visibleWeights = useMemo(() => filterByPeriod(sortedWeights, period), [sortedWeights, period]);
  const currentWeight = sortedWeights.at(-1);
  const firstWeight = sortedWeights[0];
  const lastAssessment = assessmentItems[0];
  const monthly = calculateMonthlyStats(training);
  const records = useMemo(() => calculateExerciseRecords(training), [training]);

  async function reloadBodyData() {
    const [nextWeights, nextAssessments] = await Promise.all([weights.list(uid!), assessments.list(uid!)]);
    setBody(nextWeights);
    setAssessmentItems(nextAssessments);
  }

  async function saveWeight(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const weight = parseBrazilianNumber(String(form.get("weight")));
    if (!Number.isFinite(weight) || weight <= 0 || weight > 1000) return setError("Informe um peso válido.");
    setSaving(true);
    setError("");
    try {
      const data = { date: String(form.get("date")), weight, note: String(form.get("note")).trim() || undefined };
      if (editingWeight) await weights.update(editingWeight.id, data);
      else await weights.save({ ownerId: uid!, source: "manual", ...data });
      await reloadBodyData();
      setWeightFormOpen(false);
      setEditingWeight(null);
      setMessage(editingWeight ? "Peso atualizado." : "Peso registrado.");
    } catch (reason) {
      setError(dataErrorMessage(reason, "Não foi possível salvar o peso."));
    } finally {
      setSaving(false);
    }
  }

  async function saveAssessment(value: AssessmentFormValue, files: Partial<Record<AssessmentPhotoView, File>>, alsoWeight: boolean) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const base = { ownerId: uid!, ...value, photos: editingAssessment?.photos };
      const assessmentId = await assessments.save(base, editingAssessment?.id);
      const photos = { ...(editingAssessment?.photos ?? {}) };
      const uploadWarnings: string[] = [];
      for (const [view, file] of Object.entries(files) as [AssessmentPhotoView, File][]) {
        try { photos[view] = await assessments.uploadPhoto(uid!, assessmentId, view, file); }
        catch { uploadWarnings.push(view); }
      }
      if (Object.keys(photos).length) await assessments.save({ ...base, photos }, assessmentId);
      if (alsoWeight && value.weight && !body.some((item) => item.assessmentId === assessmentId)) await weights.save({ ownerId: uid!, date: value.date, weight: value.weight, source: "assessment", assessmentId, note: "Registrado a partir de avaliação física" });
      await reloadBodyData();
      setAssessmentFormOpen(false);
      setEditingAssessment(null);
      setMessage(uploadWarnings.length ? `Avaliação salva. Fotos não enviadas: ${uploadWarnings.join(", ")}.` : "Avaliação salva com sucesso.");
    } catch (reason) {
      setError(dataErrorMessage(reason, "Não foi possível salvar a avaliação."));
    } finally {
      setSaving(false);
    }
  }

  async function removeAssessment(item: PhysicalAssessment) {
    if (!confirm(`Excluir a avaliação de ${formatDateBR(item.date)}?`)) return;
    setSaving(true);
    try {
      await assessments.remove(item.id);
      await reloadBodyData();
      setMessage("Avaliação excluída.");
    } catch (reason) {
      setError(dataErrorMessage(reason, "Não foi possível excluir a avaliação."));
    } finally {
      setSaving(false);
    }
  }

  async function loadMoreSessions(all = false) {
    setLoadingMore(true);
    try {
      if (all) {
        setTraining(await sessions.listAllCompleted(uid!));
        setHasMoreSessions(false);
        setSessionCursor(null);
      } else {
        const page = await sessions.listCompletedPage(uid!, 100, sessionCursor);
        setTraining((items) => [...items, ...page.items]);
        setSessionCursor(page.cursor);
        setHasMoreSessions(page.hasMore);
      }
    } catch (reason) {
      setError(dataErrorMessage(reason, "Não foi possível carregar mais sessões."));
    } finally {
      setLoadingMore(false);
    }
  }

  function openAssessment(item?: PhysicalAssessment) {
    setEditingAssessment(item ?? null);
    setAssessmentFormOpen(true);
  }

  const assessmentMode: AssessmentType = tab === "medidas" ? "complete" : tab === "avancada" ? "advanced" : "quick";
  const modeAssessments = assessmentItems.filter((item) => item.type === assessmentMode || (assessmentMode === "advanced" && item.type === "complete" && Boolean(item.skinfolds)));
  const measureData = [...assessmentItems].reverse().flatMap((item) => item.measurements?.[measureKey] == null ? [] : [{ date: formatDateBR(item.date), value: item.measurements[measureKey]! }]);
  const assessmentA = assessmentItems.find((item) => item.id === compareA);
  const assessmentB = assessmentItems.find((item) => item.id === compareB);
  const comparisonRows = assessmentA && assessmentB ? compareAssessments(assessmentA, assessmentB) : [];

  const executedExercises = useMemo(() => [...records.values()].filter((record) => {
    const item = library.find((exercise) => exercise.id === record.exerciseId);
    return (!exerciseGroup || item?.muscleGroup === exerciseGroup) && (!exerciseSearch || normalizeSearchText(`${record.name} ${item?.nameEn ?? ""} ${(item?.aliases ?? []).join(" ")}`).includes(normalizeSearchText(exerciseSearch)));
  }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [records, library, exerciseGroup, exerciseSearch]);
  const selectedRecord = records.get(selectedExerciseId);
  const selectedLibrary = library.find((item) => item.id === selectedExerciseId);
  const exerciseHistory = selectedExerciseId ? calculateExerciseHistory(training, selectedExerciseId, selectedLibrary?.name) : [];
  const firstExercise = exerciseHistory[0];
  const currentExercise = exerciseHistory.at(-1);
  const exerciseEvolution = firstExercise && currentExercise ? calculateEvolution(firstExercise.maxLoad, currentExercise.maxLoad) : null;
  const exerciseChartData = exerciseHistory.map((item) => ({ date: item.date.toLocaleDateString("pt-BR"), value: exerciseMetric === "bestSet" ? item.bestSet.load : item[exerciseMetric] }));

  if (!uid) return <Loading/>;

  return <AppShell><header><p className="eyebrow">EVOLUÇÃO</p><h1>Sua evolução completa.</h1><p>Peso, avaliações privadas e desempenho real derivado dos treinos.</p></header>
    <div className="evolution-tabs" role="tablist" aria-label="Seções de evolução">{tabs.map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} onClick={() => { setTab(value); setAssessmentFormOpen(false); }}>{label}</button>)}</div>
    {message && <p className="success" role="status">{message}</p>}{error && <ErrorState message={error} onRetry={() => void load()}/>} {loading ? <Loading/> : <>
      {tab === "resumo" && <><div className="stat-grid"><Card><span>Peso atual</span><strong>{currentWeight ? `${currentWeight.weight.toLocaleString("pt-BR")} kg` : "—"}</strong></Card><Card><span>Variação total</span><strong>{currentWeight && firstWeight ? `${(currentWeight.weight - firstWeight.weight).toFixed(1)} kg` : "—"}</strong></Card><Card><span>Treinos no mês</span><strong>{monthly.workouts}</strong></Card><Card><span>Recordes carregados</span><strong>{records.size}</strong></Card></div><div className="split"><Card><h2>Última avaliação</h2>{lastAssessment ? <div className="detail-grid"><div><small>Data</small>{formatDateBR(lastAssessment.date)}</div><div><small>Gordura</small>{lastAssessment.bodyFat == null ? "—" : `${lastAssessment.bodyFat}%`}</div><div><small>Massa magra</small>{lastAssessment.leanMass == null ? "—" : `${lastAssessment.leanMass} kg`}</div><div><small>Tipo</small>{lastAssessment.type}</div></div> : <Empty title="Sem avaliação física" detail="Registre uma avaliação simples ou avançada."/>}</Card><Card><h2>Recordes recentes</h2>{[...records.values()].sort((a, b) => b.maxLoadDate.getTime() - a.maxLoadDate.getTime()).slice(0, 4).map((record) => <div className="row" key={record.exerciseId}><span>{record.name}</span><strong>{record.maxLoad.toLocaleString("pt-BR")} kg</strong></div>)}{!records.size && <Empty title="Nenhum recorde ainda" detail="Eles serão derivados automaticamente das séries concluídas."/>}</Card></div></>}

      {tab === "peso" && <><div className="actions page-actions"><Button onClick={() => { setEditingWeight(null); setWeightFormOpen(true); }}>+ REGISTRAR PESO</Button><label>Período<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="30">30 dias</option><option value="90">90 dias</option><option value="180">6 meses</option><option value="365">1 ano</option><option value="all">Tudo</option></select></label></div>{weightFormOpen && <Card><h2>{editingWeight ? "Editar pesagem" : "Registrar peso"}</h2><form onSubmit={saveWeight}><label>Peso (kg)<input required name="weight" inputMode="decimal" defaultValue={editingWeight?.weight}/></label><label>Data<input required name="date" type="date" defaultValue={editingWeight?.date ?? new Date().toISOString().slice(0, 10)}/></label><label>Observação<textarea name="note" defaultValue={editingWeight?.note}/></label><div className="actions"><Button disabled={saving}>{saving ? "SALVANDO..." : "SALVAR PESO"}</Button><button type="button" className="text-button" onClick={() => { setWeightFormOpen(false); setEditingWeight(null); }}>Cancelar</button></div></form></Card>}<div className="stat-grid"><Card><span>Peso atual</span><strong>{currentWeight ? `${currentWeight.weight.toLocaleString("pt-BR")} kg` : "—"}</strong></Card><Card><span>Peso inicial</span><strong>{firstWeight ? `${firstWeight.weight.toLocaleString("pt-BR")} kg` : "—"}</strong></Card><Card><span>Variação</span><strong>{currentWeight && firstWeight ? `${(currentWeight.weight - firstWeight.weight).toFixed(1)} kg` : "—"}</strong></Card><Card><span>Registros</span><strong>{body.length}</strong></Card></div><Card className="chart"><h2>Peso corporal</h2>{visibleWeights.length ? <EvolutionChart data={visibleWeights.map((item) => ({ date: formatDateBR(item.date), value: item.weight }))} unit=" kg"/> : <Empty title="Sem pesagens no período" detail="Altere o filtro ou registre seu peso."/>}</Card><Card><h2>Histórico de peso</h2>{[...visibleWeights].reverse().map((item) => <div className="row weight-history-row" key={item.id}><div><strong>{item.weight.toLocaleString("pt-BR")} kg</strong><small>{formatDateBR(item.date)}{item.source === "assessment" ? " · avaliação" : ""}{item.note ? ` · ${item.note}` : ""}</small></div><span className="history-row-actions"><button type="button" className="history-action-button" onClick={() => { setEditingWeight(item); setWeightFormOpen(true); }}><Pencil size={15}/> Editar</button><button type="button" className="history-action-button danger" onClick={async () => { if (!confirm("Excluir esta pesagem?")) return; try { await weights.remove(item.id); await reloadBodyData(); } catch { setError("Não foi possível excluir a pesagem."); } }}><Trash2 size={15}/> Excluir</button></span></div>)}</Card></>}

      {(tab === "avaliacoes" || tab === "medidas" || tab === "avancada") && <><div className="actions page-actions"><Button onClick={() => openAssessment()}>+ NOVA {tab === "avancada" ? "AVALIAÇÃO AVANÇADA" : tab === "medidas" ? "MEDIÇÃO" : "AVALIAÇÃO"}</Button></div>{assessmentFormOpen && <Card><h2>{editingAssessment ? "Editar" : "Nova"} {assessmentMode === "quick" ? "avaliação física" : assessmentMode === "complete" ? "medição corporal" : "avaliação avançada"}</h2><AssessmentForm key={editingAssessment?.id ?? `new-${assessmentMode}`} mode={editingAssessment?.type ?? assessmentMode} initial={editingAssessment} saving={saving} profileBirthDate={profile?.birthDate} profileHeight={profile?.height} profileSex={profile?.sex} onSave={saveAssessment} onCancel={() => { setAssessmentFormOpen(false); setEditingAssessment(null); }}/></Card>}
        {tab === "medidas" && <Card className="chart"><div className="actions"><h2>Evolução de medida</h2><label>Medida<select value={measureKey} onChange={(event) => setMeasureKey(event.target.value)}>{Object.entries(BODY_MEASUREMENT_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label></div>{measureData.length ? <EvolutionChart data={measureData} unit=" cm" color="#22d3ee"/> : <Empty title="Sem dados para esta medida" detail="Registre medições em avaliações corporais."/>}</Card>}
        {(tab === "medidas" || tab === "avancada") && assessmentItems.length > 1 && <Card><h2>Comparar avaliações</h2><div className="form-grid"><label>Avaliação A<select value={compareA} onChange={(event) => setCompareA(event.target.value)}>{assessmentItems.map((item) => <option value={item.id} key={item.id}>{formatDateBR(item.date)} · {item.type}</option>)}</select></label><label>Avaliação B<select value={compareB} onChange={(event) => setCompareB(event.target.value)}>{assessmentItems.map((item) => <option value={item.id} key={item.id}>{formatDateBR(item.date)} · {item.type}</option>)}</select></label></div><div className="comparison-grid">{comparisonRows.map((row) => <div className="comparison-row" key={row.key}><strong>{row.label}</strong><span>{row.before.toLocaleString("pt-BR")} {row.unit} → {row.after.toLocaleString("pt-BR")} {row.unit}</span><b>{row.difference > 0 ? "+" : ""}{row.difference.toLocaleString("pt-BR")} {row.unit}</b></div>)}</div></Card>}
        <Card><h2>Histórico</h2>{modeAssessments.length ? modeAssessments.map((item) => <div className="assessment-item" key={item.id}><div><strong>{formatDateBR(item.date)}</strong><small>{item.weight != null ? `${item.weight} kg` : "Sem peso"}{item.bodyFat != null ? ` · ${item.bodyFat}% gordura` : ""}</small><p>{Object.keys(item.measurements ?? {}).length} medidas · {Object.keys(item.skinfolds ?? {}).length} dobras</p></div><div className="history-row-actions"><button type="button" className="history-action-button" onClick={() => openAssessment(item)}><Pencil size={15}/> Editar</button><button type="button" className="history-action-button danger" disabled={saving} onClick={() => void removeAssessment(item)}><Trash2 size={15}/> Excluir</button></div></div>) : <Empty title="Nenhum registro nesta modalidade" detail="Todos os campos corporais são opcionais."/>}</Card></>}

      {tab === "exercicios" && <><Card><div className="library-filters"><label><span>Pesquisar exercício</span><input value={exerciseSearch} onChange={(event) => setExerciseSearch(event.target.value)} placeholder="Nome, inglês ou alias"/></label><label>Grupo muscular<select value={exerciseGroup} onChange={(event) => setExerciseGroup(event.target.value)}><option value="">Todos</option>{exerciseMuscleGroups.map((item) => <option key={item}>{item}</option>)}</select></label></div><p className="muted">Somente exercícios com séries realmente concluídas aparecem por padrão.</p><div className="exercise-progress-list">{executedExercises.map((record) => <button className={selectedExerciseId === record.exerciseId ? "active" : ""} key={record.exerciseId} onClick={() => setSelectedExerciseId(record.exerciseId)}><span>{record.name}</span><strong>{record.maxLoad.toLocaleString("pt-BR")} kg</strong></button>)}</div>{!executedExercises.length && <Empty title="Nenhum exercício executado" detail="Finalize séries para criar a evolução automaticamente."/>}</Card>
        {selectedExerciseId && <><div className="stat-grid"><Card><span>Carga máxima atual</span><strong>{currentExercise ? `${currentExercise.maxLoad.toLocaleString("pt-BR")} kg` : "—"}</strong></Card><Card><span>Primeira registrada</span><strong>{firstExercise ? `${firstExercise.maxLoad.toLocaleString("pt-BR")} kg` : "—"}</strong></Card><Card><span>Evolução</span><strong>{exerciseEvolution ? `${exerciseEvolution.absolute >= 0 ? "+" : ""}${exerciseEvolution.absolute.toLocaleString("pt-BR")} kg` : "—"}</strong><small>{exerciseEvolution?.percentage == null ? "" : `${exerciseEvolution.percentage.toFixed(1)}%`}</small></Card><Card><span>Melhor série</span><strong>{selectedRecord ? `${selectedRecord.bestSet.load.toLocaleString("pt-BR")} × ${selectedRecord.bestSet.reps}` : "—"}</strong></Card></div><Card className="chart"><div className="actions"><div><h2>{selectedRecord?.name ?? selectedLibrary?.name ?? "Exercício"}</h2><p>{exerciseHistory.length} sessões registradas</p></div><label>Métrica<select value={exerciseMetric} onChange={(event) => setExerciseMetric(event.target.value as typeof exerciseMetric)}><option value="maxLoad">Carga máxima</option><option value="totalVolume">Volume</option><option value="totalReps">Repetições</option><option value="bestSet">Melhor série (carga)</option></select></label></div>{exerciseChartData.length ? <EvolutionChart data={exerciseChartData} unit={exerciseMetric === "totalReps" ? " reps" : " kg"} color="#22d3ee"/> : <Empty title="Você ainda não executou este exercício" detail="Apenas séries concluídas entram no gráfico."/>}</Card><Card><h2>Histórico do exercício</h2>{[...exerciseHistory].reverse().map((item) => <div className="exercise-history" key={item.sessionId}><strong>{item.date.toLocaleDateString("pt-BR")}</strong>{item.sets.map((set) => <span key={set.id}>{set.load.toLocaleString("pt-BR")} × {set.reps}</span>)}<small>{Math.round(item.totalVolume).toLocaleString("pt-BR")} kg de volume</small></div>)}</Card></>}
        {hasMoreSessions && <div className="actions"><Button className="outline" disabled={loadingMore} onClick={() => void loadMoreSessions(false)}>{loadingMore ? "CARREGANDO..." : "CARREGAR MAIS SESSÕES"}</Button><button className="text-button" disabled={loadingMore} onClick={() => void loadMoreSessions(true)}>Carregar histórico completo para recordes gerais</button></div>}
      </>}
    </>}
  </AppShell>;
}

export default function Page() { return <Guard><Evolution/></Guard>; }
