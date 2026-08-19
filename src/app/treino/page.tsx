"use client";

import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/guard";
import { useAuth } from "@/components/providers";
import { Button, Card, Empty, ErrorState, Loading } from "@/components/ui";
import { MethodConfigEditor } from "@/components/training-methods/method-config-editor";
import { MethodSelector } from "@/components/training-methods/method-selector";
import { TrainingMethodExecution } from "@/components/training-methods/training-method-execution";
import { TrainingGroupExecution } from "@/components/training-methods/training-group-execution";
import { detectNewRecords, timestampDate, type RecordEvent } from "@/lib/training-analytics";
import { createMethodConfig, normalTrainingMethod, snapshotMethod } from "@/lib/training-methods";
import { dataErrorMessage, exerciseMuscleGroups, normalizeSearchText } from "@/lib/utils";
import { exercises, sessions, workouts } from "@/services/data";
import { trainingMethodsService } from "@/services/training-methods";
import type { Exercise, SyncStatus, TrainingMethod, TrainingSet, Workout, WorkoutExercise, WorkoutExerciseGroup, WorkoutSession } from "@/types";
import { Check, ExternalLink, Plus, Search, Timer } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";

const newExercise = (exercise: Exercise, order: number, method = normalTrainingMethod()): WorkoutExercise => ({ id: crypto.randomUUID(), exerciseId: exercise.id, name: exercise.name, order, sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90, methodSnapshot: snapshotMethod(method), methodConfig: createMethodConfig(method) });
const reorder = (items: WorkoutExercise[]) => items.map((item, index) => ({ ...item, order: index + 1 }));
const calculateTotals = (items: WorkoutSession["exercises"]) => items.reduce((totals, exercise) => exercise.sets.reduce((next, item) => item.completed ? { totalSets: next.totalSets + 1, totalVolume: next.totalVolume + item.load * item.reps } : next, totals), { totalSets: 0, totalVolume: 0 });
const workoutInput = (workout: Workout, active = workout.active) => ({ ownerId: workout.ownerId, name: workout.name, title: workout.title, description: workout.description, muscleGroups: workout.muscleGroups, exercises: workout.exercises, exerciseGroups: workout.exerciseGroups, active });

interface TrainingSummary {
  session: WorkoutSession;
  records: RecordEvent[];
  analyticsWarning?: string;
}

function Work() {
  const { user, admin } = useAuth();
  const uid = user?.uid;
  const [plans, setPlans] = useState<Workout[]>([]);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [methods, setMethods] = useState<TrainingMethod[]>([]);
  const [builder, setBuilder] = useState<Workout | null | undefined>(undefined);
  const [draft, setDraft] = useState<WorkoutExercise[]>([]);
  const [draftGroups, setDraftGroups] = useState<WorkoutExerciseGroup[]>([]);
  const [methodTargetId, setMethodTargetId] = useState<string | null>(null);
  const [groupMethodId, setGroupMethodId] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [active, setActive] = useState<WorkoutSession | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const [summary, setSummary] = useState<TrainingSummary | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setLoadError("");
    try {
      const [nextPlans, nextActive, nextLibrary, nextMethods] = await Promise.all([workouts.list(uid), sessions.getActive(uid), exercises.list(), trainingMethodsService.list()]);
      setPlans(nextPlans);
      setActive(nextActive);
      setLibrary(nextLibrary);
      setMethods(nextMethods.length ? nextMethods : [normalTrainingMethod()]);
    } catch (error) {
      setLoadError(dataErrorMessage(error, "Verifique sua conexão e tente novamente."));
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!session?.restEndsAt) return;
    const timer = window.setInterval(() => setClock(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [session?.restEndsAt]);

  const filteredLibrary = useMemo(() => library.filter((item) => item.active && (!group || item.muscleGroup === group)).filter((item) => {
    const queryText = normalizeSearchText(search);
    return !queryText || [item.name, item.nameEn, ...(item.aliases ?? [])].filter(Boolean).some((value) => normalizeSearchText(value!).includes(queryText));
  }), [library, search, group]);

  const activePlans = plans.filter((item) => item.active);
  const archivedPlans = plans.filter((item) => !item.active);
  const restSeconds = session?.restEndsAt ? Math.max(0, Math.ceil((session.restEndsAt.toMillis() - clock) / 1000)) : 0;

  if (!uid) return <Loading />;

  function openBuilder(workout?: Workout) {
    setBuilder(workout ?? null);
    setDraft(workout ? reorder(workout.exercises) : []);
    setDraftGroups(workout?.exerciseGroups ?? []);
    setName(workout?.name ?? "");
    setTitle(workout?.title ?? "");
    setDescription(workout?.description ?? "");
    setSearch("");
    setGroup("");
    setMessage("");
    setMethodTargetId(null);
    setGroupMethodId("");
    setGroupMembers([]);
  }

  function updateDraft(id: string, data: Partial<WorkoutExercise>) {
    setDraft((items) => items.map((item) => item.id === id ? { ...item, ...data } : item));
  }

  function addExercise(exercise: Exercise) {
    if (draft.some((item) => item.exerciseId === exercise.id)) return;
    setDraft((items) => [...items, newExercise(exercise, items.length + 1, methods.find((item) => item.id === "series-normais") ?? normalTrainingMethod())]);
  }

  function chooseMethod(exerciseId: string, method: TrainingMethod) {
    const values = method.defaults;
    updateDraft(exerciseId, {
      methodSnapshot: snapshotMethod(method),
      methodConfig: createMethodConfig(method),
      sets: typeof values.sets === "number" ? Math.max(1, Math.round(values.sets)) : 3,
      repsMin: typeof values.repsMin === "number" ? Math.max(1, Math.round(values.repsMin)) : 8,
      repsMax: typeof values.repsMax === "number" ? Math.max(1, Math.round(values.repsMax)) : 12,
      restSeconds: typeof values.restSeconds === "number" ? Math.max(0, Math.round(values.restSeconds)) : 90,
      suggestedLoad: typeof values.suggestedLoad === "number" ? values.suggestedLoad : undefined,
    });
    setMethodTargetId(null);
  }

  function addExerciseGroup() {
    const method = methods.find((item) => item.id === groupMethodId && item.active && item.engine === "group");
    if (!method) return setMessage("Escolha um método combinado ativo.");
    if (groupMembers.length < method.exerciseRules.minExercises || groupMembers.length > method.exerciseRules.maxExercises) return setMessage(`${method.name} exige de ${method.exerciseRules.minExercises} a ${method.exerciseRules.maxExercises} exercícios.`);
    if (method.exerciseRules.sameMuscleGroup) {
      const muscleGroups = new Set(groupMembers.map((id) => library.find((exercise) => exercise.id === draft.find((item) => item.id === id)?.exerciseId)?.muscleGroup).filter(Boolean));
      if (muscleGroups.size > 1) return setMessage(`${method.name} exige exercícios do mesmo grupo muscular.`);
    }
    if (draftGroups.some((item) => item.exerciseIds.some((id) => groupMembers.includes(id)))) return setMessage("Um exercício só pode participar de um grupo por treino.");
    const id = crypto.randomUUID();
    const group: WorkoutExerciseGroup = { id, name: `${method.name} ${draftGroups.length + 1}`, order: draftGroups.length + 1, exerciseIds: groupMembers, methodSnapshot: snapshotMethod(method), methodConfig: createMethodConfig(method) };
    setDraftGroups((items) => [...items, group]);
    setDraft((items) => items.map((item) => groupMembers.includes(item.id) ? { ...item, groupId: id, groupPosition: groupMembers.indexOf(item.id), methodSnapshot: snapshotMethod(method), methodConfig: createMethodConfig(method) } : item));
    setGroupMethodId(""); setGroupMembers([]); setMessage("");
  }

  function removeExerciseGroup(groupId: string) {
    const normal = normalTrainingMethod();
    setDraftGroups((items) => items.filter((item) => item.id !== groupId).map((item, index) => ({ ...item, order: index + 1 })));
    setDraft((items) => items.map((item) => item.groupId === groupId ? { ...item, groupId: undefined, groupPosition: undefined, methodSnapshot: snapshotMethod(normal), methodConfig: createMethodConfig(normal) } : item));
  }

  function moveExercise(index: number, direction: -1 | 1) {
    setDraft((items) => {
      const next = [...items];
      const destination = index + direction;
      if (destination < 0 || destination >= next.length) return items;
      [next[index], next[destination]] = [next[destination], next[index]];
      return reorder(next);
    });
  }

  function removeDraftExercise(id: string) {
    setDraft((items) => reorder(items.filter((candidate) => candidate.id !== id)));
    setDraftGroups((items) => items.map((groupItem) => ({ ...groupItem, exerciseIds: groupItem.exerciseIds.filter((exerciseId) => exerciseId !== id) })).filter((groupItem) => groupItem.exerciseIds.length));
    setGroupMembers((items) => items.filter((exerciseId) => exerciseId !== id));
  }

  async function reloadPlans() {
    setPlans(await workouts.list(uid!));
  }

  async function saveWorkout(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !title.trim() || !draft.length) return setMessage("Informe nome, título e adicione ao menos um exercício.");
    if (draft.some((item) => !Number.isInteger(item.sets) || item.sets < 1 || !Number.isInteger(item.repsMin) || item.repsMin < 1 || !Number.isInteger(item.repsMax) || item.repsMax < item.repsMin || !Number.isFinite(item.restSeconds) || item.restSeconds < 0)) return setMessage("Revise séries, repetições e descanso.");
    for (const item of draftGroups) if (item.exerciseIds.length < item.methodSnapshot.exerciseRules.minExercises || item.exerciseIds.length > item.methodSnapshot.exerciseRules.maxExercises) return setMessage(`Revise o grupo ${item.name}.`);
    setSaving(true);
    setMessage("");
    try {
      await workouts.save({
        ownerId: uid!,
        name: name.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        muscleGroups: [...new Set(draft.map((item) => library.find((exercise) => exercise.id === item.exerciseId)?.muscleGroup).filter((item): item is string => Boolean(item)))],
        active: builder?.active ?? true,
        exercises: reorder(draft),
        exerciseGroups: draftGroups,
      }, builder?.id);
      await reloadPlans();
      setBuilder(undefined);
      setMessage(builder ? "Treino atualizado com sucesso." : "Treino criado com sucesso.");
    } catch (error) {
      setMessage(dataErrorMessage(error, "Não foi possível salvar o treino."));
    } finally {
      setSaving(false);
    }
  }

  async function importLibrary() {
    setImporting(true);
    try {
      await exercises.seedDefaultLibrary();
      setLibrary(await exercises.list());
    } catch (error) {
      setMessage(dataErrorMessage(error, "Não foi possível importar a biblioteca."));
    } finally {
      setImporting(false);
    }
  }

  async function start(workout: Workout) {
    setMessage("");
    try {
      const created = await sessions.start(uid!, workout);
      setSession(created);
      setActive(created);
      setSyncStatus(navigator.onLine ? "saved" : "offline");
    } catch (error) {
      const current = await sessions.getActive(uid!).catch(() => null);
      if (current) setActive(current);
      setMessage(dataErrorMessage(error, "Não foi possível iniciar o treino."));
    }
  }

  function localSession(next: WorkoutSession) {
    const totals = calculateTotals(next.exercises);
    const value = { ...next, ...totals };
    setSession(value);
    setActive(value);
    setSyncStatus("idle");
    return value;
  }

  async function syncSession(next: WorkoutSession) {
    const value = localSession(next);
    setSyncStatus("saving");
    try {
      const pendingWrite = sessions.save(value.id, { exercises: value.exercises, totalSets: value.totalSets, totalVolume: value.totalVolume, restEndsAt: value.restEndsAt, notes: value.notes });
      if (!navigator.onLine) {
        setSyncStatus("offline");
        void pendingWrite.then(() => setSyncStatus("saved")).catch(() => setSyncStatus("error"));
        return;
      }
      await pendingWrite;
      setSyncStatus("saved");
    } catch {
      setSyncStatus("error");
    }
  }

  function changeSet(exerciseIndex: number, setIndex: number, data: Partial<TrainingSet>) {
    if (!session) return null;
    return localSession({ ...session, exercises: session.exercises.map((exercise, currentExercise) => currentExercise !== exerciseIndex ? exercise : {
      ...exercise,
      sets: exercise.sets.map((item, currentSet) => currentSet !== setIndex ? item : { ...item, ...data, volume: (data.completed ?? item.completed) ? (data.load ?? item.load) * (data.reps ?? item.reps) : 0 }),
    }) });
  }

  async function completeSet(exerciseIndex: number, setIndex: number, completed: boolean) {
    const next = changeSet(exerciseIndex, setIndex, { completed });
    if (!next) return;
    const set = next.exercises[exerciseIndex].sets[setIndex];
    const restEndsAt = completed && (set.restAfterSeconds ?? next.exercises[exerciseIndex].target.restSeconds) > 0 ? Timestamp.fromMillis(Date.now() + (set.restAfterSeconds ?? next.exercises[exerciseIndex].target.restSeconds) * 1000) : completed ? undefined : next.restEndsAt;
    await syncSession({ ...next, restEndsAt });
    setClock(Date.now());
  }

  async function addSet(exerciseIndex: number) {
    if (!session) return;
    await syncSession({ ...session, exercises: session.exercises.map((exercise, index) => index !== exerciseIndex ? exercise : { ...exercise, sets: [...exercise.sets, { id: crypto.randomUUID(), load: exercise.target.suggestedLoad ?? 0, reps: exercise.target.repsMin, completed: false, volume: 0, methodId: "series-normais", methodEngine: "normal", methodVersion: 1, setRole: "working", restAfterSeconds: exercise.target.restSeconds }] }) });
  }

  async function removeSet(exerciseIndex: number, setIndex: number) {
    if (!session || session.exercises[exerciseIndex].sets[setIndex].completed) return;
    await syncSession({ ...session, exercises: session.exercises.map((exercise, index) => index !== exerciseIndex ? exercise : { ...exercise, sets: exercise.sets.filter((_, itemIndex) => itemIndex !== setIndex) }) });
  }

  async function finish() {
    if (!session) return;
    setSaving(true);
    setMessage("");
    try {
      const started = timestampDate(session.startedAt).getTime();
      const durationSeconds = Math.max(0, Math.round((Date.now() - (started || Date.now())) / 1000));
      const completed = await sessions.complete(session, durationSeconds);
      let records: RecordEvent[] = [];
      let analyticsWarning: string | undefined;
      try {
        const previous = (await sessions.listAllCompleted(uid!)).filter((item) => item.id !== completed.id);
        records = detectNewRecords(previous, completed);
      } catch {
        analyticsWarning = "O treino foi salvo, mas os recordes não puderam ser calculados agora.";
      }
      setSummary({ session: completed, records, analyticsWarning });
      setSession(null);
      setActive(null);
      setSyncStatus("idle");
    } catch (error) {
      setMessage(dataErrorMessage(error, "Não foi possível finalizar o treino."));
    } finally {
      setSaving(false);
    }
  }

  async function cancel(target: WorkoutSession) {
    setSaving(true);
    try {
      await sessions.cancel(target);
      setSession(null);
      setActive(null);
      setSyncStatus("idle");
    } catch (error) {
      setMessage(dataErrorMessage(error, "Não foi possível cancelar a sessão."));
    } finally {
      setSaving(false);
    }
  }

  if (summary) return <AppShell><header><p className="eyebrow">TREINO CONCLUÍDO</p><h1>{summary.session.workoutName}</h1><p>Seu desempenho foi salvo no histórico.</p></header><div className="stat-grid"><Card><span>Duração</span><strong>{Math.round((summary.session.durationSeconds ?? 0) / 60)} min</strong></Card><Card><span>Volume</span><strong>{Math.round(summary.session.totalVolume).toLocaleString("pt-BR")} kg</strong></Card><Card><span>Séries</span><strong>{summary.session.totalSets}</strong></Card><Card><span>Exercícios</span><strong>{summary.session.exercises.length}</strong></Card></div><Card><h2>Recordes alcançados</h2>{summary.records.length ? summary.records.map((record, index) => <div className="row" key={`${record.exerciseId}-${record.kind}-${index}`}><strong>{record.name}</strong><span>{record.kind === "load" ? `${record.value.toLocaleString("pt-BR")} kg` : record.kind === "reps" ? `${record.value} repetições` : `${Math.round(record.value).toLocaleString("pt-BR")} kg de volume`}</span></div>) : <Empty title="Nenhum recorde novo nesta sessão" detail="Continue treinando para acompanhar sua progressão automática."/>}{summary.analyticsWarning && <p className="error">{summary.analyticsWarning}</p>}</Card><Button onClick={() => setSummary(null)}>VOLTAR AOS TREINOS</Button></AppShell>;

  if (session) return <AppShell><header><p className="eyebrow">EM ANDAMENTO</p><h1>{session.workoutName}</h1><p>{session.totalSets} séries concluídas · {Math.round(session.totalVolume).toLocaleString("pt-BR")} kg</p><p className={`sync-status ${syncStatus}`} role="status">{syncStatus === "saving" ? "Salvando..." : syncStatus === "saved" ? "Salvo" : syncStatus === "offline" ? "Salvo neste dispositivo. Aguardando sincronização." : syncStatus === "error" ? "Erro ao sincronizar. Use Tentar novamente." : "Alterações locais"}{syncStatus === "error" && <button className="text-button" onClick={() => void syncSession(session)}>Tentar novamente</button>}</p></header>
    {restSeconds > 0 && <Card className="rest"><Timer/><strong>{String(Math.floor(restSeconds / 60)).padStart(2, "0")}:{String(restSeconds % 60).padStart(2, "0")}</strong><Button onClick={() => void syncSession({ ...session, restEndsAt: undefined })}>PULAR DESCANSO</Button><button className="text-button" onClick={() => void syncSession({ ...session, restEndsAt: Timestamp.fromMillis((session.restEndsAt?.toMillis() ?? Date.now()) + 15000) })}>+15s</button></Card>}
    {session.exercises.map((exercise, exerciseIndex) => { if (exercise.target.groupId) { const group = session.exerciseGroups?.find((item) => item.id === exercise.target.groupId); if (!group || group.exerciseIds[0] !== exercise.id) return null; const members = group.exerciseIds.map((id) => session.exercises.find((item) => item.id === id)).filter((item): item is typeof exercise => Boolean(item)); return <TrainingGroupExecution key={group.id} group={group} members={members} allExercises={session.exercises} onChange={changeSet} onComplete={(item, set, completed) => void completeSet(item, set, completed)} onSync={() => session && void syncSession(session)}/>; } return <TrainingMethodExecution key={exercise.id} exercise={exercise} exerciseIndex={exerciseIndex} onChange={changeSet} onComplete={(item, set, completed) => void completeSet(item, set, completed)} onAdd={(item) => void addSet(item)} onRemove={(item, set) => void removeSet(item, set)} onSync={() => session && void syncSession(session)}/>; })}
    {message && <p className="error" role="alert">{message}</p>}<Button className="finish" onClick={() => void finish()} disabled={saving}>{saving ? "FINALIZANDO..." : "FINALIZAR TREINO"}</Button><button className="text-button" onClick={() => void cancel(session)} disabled={saving}>Cancelar treino</button>
  </AppShell>;

  return <AppShell><header><p className="eyebrow">SESSÃO</p><h1>Qual treino vamos fazer?</h1><Button onClick={() => openBuilder()}><Plus size={16}/> NOVO TREINO</Button></header>
    {message && <p className={message.includes("sucesso") ? "success" : "error"} role="status">{message}</p>}
    {loadError && <ErrorState message={loadError} onRetry={() => void load()}/>} {loading && <Loading/>}
    {!loading && active && <Card><span>TREINO EM ANDAMENTO</span><h2>{active.workoutName}</h2><p>Há uma sessão ativa salva. Resolva-a antes de iniciar outra.</p><Button onClick={() => { setSession(active); setClock(Date.now()); }}>RETOMAR</Button><button className="text-button" onClick={() => void cancel(active)} disabled={saving}>CANCELAR SESSÃO</button></Card>}
    {methodTargetId && <MethodSelector methods={methods} currentId={draft.find((item) => item.id === methodTargetId)?.methodSnapshot?.id} onClose={() => setMethodTargetId(null)} onSelect={(method) => chooseMethod(methodTargetId, method)}/>}
    {!loading && builder !== undefined && <Card className="workout-builder-card"><div className="builder-title"><div><span>{builder ? "EDIÇÃO" : "NOVO TREINO"}</span><h2>{builder ? "Editar treino" : "Monte seu treino"}</h2><p>Adicione os exercícios e salve quando terminar.</p></div><button type="button" className="text-button" onClick={() => setBuilder(undefined)}>Fechar</button></div>
      {!library.length ? <div className="empty"><strong>Biblioteca ainda não foi importada.</strong><span>Peça ao administrador para importar a biblioteca no painel administrativo.</span>{admin && <Button onClick={() => void importLibrary()} disabled={importing}>{importing ? "IMPORTANDO..." : "IMPORTAR 202 EXERCÍCIOS"}</Button>}</div> : <form className="workout-builder" onSubmit={saveWorkout}>
        <div className="form-grid workout-info"><label>Nome do treino<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Treino A"/></label><label>Título<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Peito e tríceps"/></label><label className="workout-description">Descrição<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Opcional"/></label></div>
        <section className="builder-section"><div className="builder-section-title"><div><span>1</span><div><h3>Adicionar exercício</h3><p>Pesquise e adicione cada exercício.</p></div></div></div><div className="library-filters"><label><span className="sr-only">Pesquisar exercícios</span><span className="search-input"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, inglês ou alias"/></span></label><label>Grupo<select value={group} onChange={(event) => setGroup(event.target.value)}><option value="">Todos os grupos</option>{exerciseMuscleGroups.map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="exercise-picker">{filteredLibrary.map((item) => { const added = draft.some((candidate) => candidate.exerciseId === item.id); return <article key={item.id} className={`library-item ${added ? "selected" : ""}`}><div><strong>{item.name}</strong><small>{item.muscleGroup}</small></div><div>{item.videoUrl && <a className="video-link" href={item.videoUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Vídeo</a>}<button type="button" className={`exercise-add-button ${added ? "added" : ""}`} onClick={() => addExercise(item)} disabled={added}>{added ? <><Check size={16}/> ADICIONADO</> : <><Plus size={16}/> ADICIONAR EXERCÍCIO</>}</button></div></article>; })}</div>{!filteredLibrary.length && <Empty title="Nenhum exercício encontrado" detail="Tente outro nome ou remova os filtros."/>}</section>
        <section className="builder-section"><div className="builder-section-title"><div><span>2</span><div><h3>Exercícios adicionados <b>{draft.length}</b></h3><p>Escolha um método e ajuste somente os parâmetros compatíveis.</p></div></div></div>{!draft.length && <Empty title="Nenhum exercício adicionado" detail="Use Adicionar exercício na biblioteca acima."/>}{draft.map((item, index) => { const method = item.methodSnapshot ?? snapshotMethod(normalTrainingMethod()); const catalogMethod = methods.find((candidate) => candidate.id === method.id); return <div className="card workout-draft-item" key={item.id}><div className="row"><strong>{index + 1}. {item.name}</strong><span><button type="button" className="draft-order-button" onClick={() => moveExercise(index, -1)} disabled={index === 0} aria-label={`Mover ${item.name} para cima`}>↑</button><button type="button" className="draft-order-button" onClick={() => moveExercise(index, 1)} disabled={index === draft.length - 1} aria-label={`Mover ${item.name} para baixo`}>↓</button><button type="button" className="draft-remove-button" onClick={() => removeDraftExercise(item.id)}>Remover</button></span></div><div className="method-summary"><div><small>Método</small><strong>{method.name}</strong>{catalogMethod?.active === false && <span className="method-disabled">Desativado para novos treinos; snapshot preservado.</span>}</div><button type="button" className="method-change-button" disabled={Boolean(item.groupId)} onClick={() => setMethodTargetId(item.id)}>{item.groupId ? "Definido pelo grupo" : "ALTERAR MÉTODO"}</button></div><div className="form-grid">{method.capabilities.sets && <label>Séries<input type="number" min="1" step="1" value={item.sets} onChange={(event) => updateDraft(item.id, { sets: Number(event.target.value) })}/></label>}{method.capabilities.rest && <label>Descanso (s)<input type="number" min="0" step="1" value={item.restSeconds} onChange={(event) => updateDraft(item.id, { restSeconds: Number(event.target.value) })}/></label>}{method.capabilities.reps && <><label>Repetições mín.<input type="number" min="1" step="1" value={item.repsMin} onChange={(event) => updateDraft(item.id, { repsMin: Number(event.target.value) })}/></label><label>Repetições máx.<input type="number" min="1" step="1" value={item.repsMax} onChange={(event) => updateDraft(item.id, { repsMax: Number(event.target.value) })}/></label></>}{method.capabilities.load && <label>Carga sugerida (kg)<input type="number" min="0" step="0.1" value={item.suggestedLoad ?? ""} onChange={(event) => updateDraft(item.id, { suggestedLoad: event.target.value === "" ? undefined : Number(event.target.value) })}/></label>}<label>Observação<textarea value={item.notes ?? ""} onChange={(event) => updateDraft(item.id, { notes: event.target.value || undefined })}/></label></div>{item.methodConfig && <MethodConfigEditor method={method} config={item.methodConfig} onChange={(methodConfig) => updateDraft(item.id, { methodConfig })}/>}</div>})}</section>
        <section className="builder-section group-builder"><div className="builder-section-title"><div><span>3</span><div><h3>Combinar exercícios</h3><p>Crie bi-sets, tri-sets, supersets e sequências maiores.</p></div></div></div>{draftGroups.map((item) => <div className="group-card" key={item.id}><div><strong>{item.name}</strong><small>{item.exerciseIds.map((id) => draft.find((exercise) => exercise.id === id)?.name).filter(Boolean).join(" → ")}</small></div><button type="button" className="text-button danger-text" onClick={() => removeExerciseGroup(item.id)}>Remover grupo</button></div>)}<div className="group-create"><label>Método combinado<select value={groupMethodId} onChange={(event) => { setGroupMethodId(event.target.value); setGroupMembers([]); }}><option value="">Selecione</option>{methods.filter((item) => item.active && item.engine === "group").map((item) => <option value={item.id} key={item.id}>{item.name} ({item.exerciseRules.minExercises}–{item.exerciseRules.maxExercises})</option>)}</select></label><fieldset><legend>Exercícios do grupo, na ordem</legend>{draft.filter((item) => !item.groupId).map((item) => <label className="method-check" key={item.id}><input type="checkbox" checked={groupMembers.includes(item.id)} onChange={(event) => setGroupMembers((items) => event.target.checked ? [...items, item.id] : items.filter((id) => id !== item.id))}/>{item.name}</label>)}</fieldset><Button type="button" className="outline" onClick={addExerciseGroup} disabled={!groupMethodId}>CRIAR GRUPO</Button></div></section>
        <div className="workout-form-actions"><Button type="submit" className="workout-submit" disabled={saving}>{saving ? "SALVANDO..." : builder ? "SALVAR ALTERAÇÕES" : `CRIAR TREINO (${draft.length})`}</Button><button type="button" className="text-button" onClick={() => setBuilder(undefined)} disabled={saving}>Cancelar</button></div>
      </form>}
    </Card>}
    {!loading && <><h2>Treinos ativos</h2><div className="cards">{activePlans.map((workout) => <Card key={workout.id}><h2>{workout.title}</h2><p>{workout.description}</p><small>{workout.exercises.length} exercícios</small><div className="plan-actions"><Button onClick={() => void start(workout)} disabled={Boolean(active)}>INICIAR</Button><button className="text-button" onClick={() => openBuilder(workout)}>Editar</button><button className="text-button" onClick={async () => { try { await workouts.duplicate(workout); await reloadPlans(); } catch { setMessage("Não foi possível duplicar o treino."); } }}>Duplicar</button><button className="text-button" onClick={async () => { try { await workouts.save(workoutInput(workout, false), workout.id); await reloadPlans(); } catch { setMessage("Não foi possível arquivar o treino."); } }}>Arquivar</button></div></Card>)}</div>{!activePlans.length && builder === undefined && <Empty title="Nenhum treino ativo" detail="Use Novo treino para montar o seu."/>}
      {archivedPlans.length > 0 && <section className="archived-section"><h2>Treinos arquivados</h2><div className="cards">{archivedPlans.map((workout) => <Card key={workout.id}><h2>{workout.title}</h2><p>{workout.description}</p><small>{workout.exercises.length} exercícios</small><div className="plan-actions"><Button className="outline" onClick={async () => { try { await workouts.save(workoutInput(workout, true), workout.id); await reloadPlans(); } catch { setMessage("Não foi possível restaurar o treino."); } }}>RESTAURAR</Button><button className="text-button danger-text" onClick={async () => { if (!confirm(`Excluir definitivamente ${workout.name}? As sessões históricas serão preservadas.`)) return; try { await workouts.remove(workout.id); await reloadPlans(); } catch { setMessage("Não foi possível excluir o treino."); } }}>Excluir definitivamente</button></div></Card>)}</div></section>}</>}
  </AppShell>;
}

export default function Training() { return <Guard><Work/></Guard>; }
