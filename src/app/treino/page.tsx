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
import { Archive, Bell, Check, ChevronDown, Copy, ExternalLink, History, Pencil, Play, Plus, Search, Timer } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { workoutExerciseIssue, workoutFormSchema } from "@/lib/validation";

const NOTIFICATION_ICON = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/xtrainer-user-icon-192.png`;
// "renotify" existe na Notification API dos navegadores mas falta no lib.dom.d.ts do TypeScript.
type ExtendedNotificationOptions = NotificationOptions & { renotify?: boolean };

async function closeRestNotification() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const items = await registration.getNotifications({ tag: "xtrainer-rest" });
    items.forEach((item) => item.close());
  } catch { /* notificações indisponíveis neste navegador */ }
}

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
  const [collapsedDraftIds, setCollapsedDraftIds] = useState<Set<string>>(() => new Set());
  const [expandedPlanIds, setExpandedPlanIds] = useState<Set<string>>(() => new Set());
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
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [hasPendingWrites, setHasPendingWrites] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [completedCounts, setCompletedCounts] = useState<Map<string, number>>(new Map());
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission | "unsupported">(() => (typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"));
  const prevRestSecondsRef = useRef(0);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setLoadError("");
    try {
      const [plansResult, activeResult, libraryResult, methodsResult, completedResult] = await Promise.allSettled([
        workouts.list(uid),
        sessions.getActive(uid),
        exercises.list(),
        trainingMethodsService.list(),
        sessions.listAllCompleted(uid),
      ]);

      if (plansResult.status === "fulfilled") setPlans(plansResult.value);
      if (activeResult.status === "fulfilled") setActive(activeResult.value);
      if (libraryResult.status === "fulfilled") setLibrary(libraryResult.value);
      setMethods(methodsResult.status === "fulfilled" && methodsResult.value.length ? methodsResult.value : [normalTrainingMethod()]);
      if (completedResult.status === "fulfilled") {
        const counts = new Map<string, number>();
        for (const completedSession of completedResult.value) counts.set(completedSession.workoutId, (counts.get(completedSession.workoutId) ?? 0) + 1);
        setCompletedCounts(counts);
      }

      const requiredFailure = [plansResult, libraryResult].find((result) => result.status === "rejected");
      if (requiredFailure?.status === "rejected") {
        setLoadError(dataErrorMessage(requiredFailure.reason, "Não foi possível carregar seus treinos ou a biblioteca de exercícios."));
      }
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
  useEffect(() => {
    const previous = prevRestSecondsRef.current;
    prevRestSecondsRef.current = restSeconds;
    if (notifyPermission !== "granted" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.ready.then((registration) => {
      if (restSeconds > 0) {
        const minutes = String(Math.floor(restSeconds / 60)).padStart(2, "0");
        const secondsLabel = String(restSeconds % 60).padStart(2, "0");
        return registration.showNotification("Descanso em andamento", { body: `⏱️ ${minutes}:${secondsLabel} restantes`, tag: "xtrainer-rest", silent: true, icon: NOTIFICATION_ICON, badge: NOTIFICATION_ICON });
      }
      if (previous > 0 && session) {
        return registration.showNotification("Descanso finalizado!", { body: "Hora da próxima série 💪", tag: "xtrainer-rest", renotify: true, icon: NOTIFICATION_ICON, badge: NOTIFICATION_ICON } as ExtendedNotificationOptions);
      }
    }).catch(() => undefined);
  }, [restSeconds, notifyPermission, session]);

  // O navegador só nos avisa quando a interface de rede muda de estado; isso já cobre o caso
  // clássico de academia (wifi cai, some o sinal) sem depender de tentar uma escrita para descobrir.
  useEffect(() => {
    function goOnline() { setIsOnline(true); }
    function goOffline() { setIsOnline(false); }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Acompanha se as últimas alterações da sessão ativa (séries marcadas, descanso ajustado etc.)
  // já foram confirmadas pelo servidor. Enquanto offline, elas continuam salvas no cache
  // persistente do Firestore neste aparelho e são reenviadas sozinhas assim que a conexão volta.
  useEffect(() => {
    if (!session?.id) return;
    return sessions.watchSyncState(session.id, setHasPendingWrites);
  }, [session?.id]);

  const syncStatus: SyncStatus = saveError ? "error" : !isOnline ? "offline" : hasPendingWrites ? "saving" : "saved";

  if (!uid) return <Loading />;

  function openBuilder(workout?: Workout) {
    setBuilder(workout ?? null);
    setDraft(workout ? reorder(workout.exercises) : []);
    setCollapsedDraftIds(new Set());
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

  function setDraftCollapsed(id: string, collapsed: boolean) {
    setCollapsedDraftIds((ids) => {
      const next = new Set(ids);
      if (collapsed) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function togglePlanExercises(id: string) {
    setExpandedPlanIds((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function finishDraftExercise(item: WorkoutExercise) {
    const issue = workoutExerciseIssue(item);
    if (issue) {
      setMessage(issue);
      return;
    }
    setMessage("");
    setDraftCollapsed(item.id, true);
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
    setCollapsedDraftIds((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
    setDraftGroups((items) => items.map((groupItem) => ({ ...groupItem, exerciseIds: groupItem.exerciseIds.filter((exerciseId) => exerciseId !== id) })).filter((groupItem) => groupItem.exerciseIds.length));
    setGroupMembers((items) => items.filter((exerciseId) => exerciseId !== id));
  }

  async function reloadPlans() {
    setPlans(await workouts.list(uid!));
  }

  async function saveWorkout(event: React.FormEvent) {
    event.preventDefault();
    const formResult = workoutFormSchema.safeParse({ name, title, exercises: draft });
    if (!formResult.success) return setMessage(formResult.error.issues[0]?.message ?? "Revise os dados do treino.");
    const exerciseIssue = draft.map(workoutExerciseIssue).find(Boolean);
    if (exerciseIssue) return setMessage(exerciseIssue);
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

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotifyPermission(result);
  }

  async function start(workout: Workout) {
    setMessage("");
    setSaveError(false);
    try {
      const created = await sessions.start(uid!, workout);
      setSession(created);
      setActive(created);
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
    return value;
  }

  async function syncSession(next: WorkoutSession) {
    const value = localSession(next);
    try {
      // Com o cache persistente do Firestore, esta escrita fica registrada no aparelho
      // imediatamente; se estiver offline, a promise só resolve quando a conexão voltar e o
      // servidor confirmar — por isso o indicador de status (syncStatus) não depende dela, e sim
      // do listener de hasPendingWrites acima, que reflete o estado real do cache local.
      await sessions.save(value.id, { exercises: value.exercises, totalSets: value.totalSets, totalVolume: value.totalVolume, restEndsAt: value.restEndsAt, notes: value.notes });
      setSaveError(false);
    } catch {
      setSaveError(true);
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

  async function swapExercise(exerciseIndex: number, replacement: Exercise) {
    if (!session) return;
    await syncSession({ ...session, exercises: session.exercises.map((exercise, index) => index !== exerciseIndex ? exercise : { ...exercise, exerciseId: replacement.id, name: replacement.name }) });
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
      setSaveError(false);
      void closeRestNotification();
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
      setSaveError(false);
      void closeRestNotification();
    } catch (error) {
      setMessage(dataErrorMessage(error, "Não foi possível cancelar a sessão."));
    } finally {
      setSaving(false);
    }
  }

  if (summary) return <AppShell><header><p className="eyebrow">TREINO CONCLUÍDO</p><h1>{summary.session.workoutName}</h1><p>Seu desempenho foi salvo no histórico.</p></header><div className="stat-grid"><Card><span>Duração</span><strong>{Math.round((summary.session.durationSeconds ?? 0) / 60)} min</strong></Card><Card><span>Volume</span><strong>{Math.round(summary.session.totalVolume).toLocaleString("pt-BR")} kg</strong></Card><Card><span>Séries</span><strong>{summary.session.totalSets}</strong></Card><Card><span>Exercícios</span><strong>{summary.session.exercises.length}</strong></Card></div><Card><h2>Recordes alcançados</h2>{summary.records.length ? summary.records.map((record, index) => <div className="row" key={`${record.exerciseId}-${record.kind}-${index}`}><strong>{record.name}</strong><span>{record.kind === "load" ? `${record.value.toLocaleString("pt-BR")} kg` : record.kind === "reps" ? `${record.value} repetições` : `${Math.round(record.value).toLocaleString("pt-BR")} kg de volume`}</span></div>) : <Empty title="Nenhum recorde novo nesta sessão" detail="Continue treinando para acompanhar sua progressão automática."/>}{summary.analyticsWarning && <p className="error">{summary.analyticsWarning}</p>}</Card><Button onClick={() => setSummary(null)}>VOLTAR AOS TREINOS</Button></AppShell>;

  if (session) return <AppShell><header><p className="eyebrow">EM ANDAMENTO</p><h1>{session.workoutName}</h1><p>{session.totalSets} séries concluídas · {Math.round(session.totalVolume).toLocaleString("pt-BR")} kg</p><p className={`sync-status ${syncStatus}`} role="status">{syncStatus === "saving" ? "Salvando..." : syncStatus === "saved" ? "Salvo" : syncStatus === "offline" ? "Salvo neste dispositivo. Aguardando sincronização." : syncStatus === "error" ? "Erro ao sincronizar. Use Tentar novamente." : "Alterações locais"}{syncStatus === "error" && <button className="text-button" onClick={() => void syncSession(session)}>Tentar novamente</button>}</p>{notifyPermission === "default" && <button type="button" className="text-button" onClick={() => void enableNotifications()}><Bell size={15}/> Ativar notificações do cronômetro de descanso</button>}{notifyPermission === "denied" && <p className="error">Notificações bloqueadas pelo navegador. Ative nas configurações do site para ver o cronômetro de descanso nas notificações.</p>}</header>
    {restSeconds > 0 && <Card className="rest"><Timer/><strong>{String(Math.floor(restSeconds / 60)).padStart(2, "0")}:{String(restSeconds % 60).padStart(2, "0")}</strong><Button onClick={() => void syncSession({ ...session, restEndsAt: undefined })}>PULAR DESCANSO</Button><button className="text-button" onClick={() => void syncSession({ ...session, restEndsAt: Timestamp.fromMillis((session.restEndsAt?.toMillis() ?? Date.now()) + 15000) })}>+15s</button></Card>}
    {session.exercises.map((exercise, exerciseIndex) => { if (exercise.target.groupId) { const group = session.exerciseGroups?.find((item) => item.id === exercise.target.groupId); if (!group || group.exerciseIds[0] !== exercise.id) return null; const members = group.exerciseIds.map((id) => session.exercises.find((item) => item.id === id)).filter((item): item is typeof exercise => Boolean(item)); return <TrainingGroupExecution key={group.id} group={group} members={members} allExercises={session.exercises} library={library} onChange={changeSet} onComplete={(item, set, completed) => void completeSet(item, set, completed)} onSwap={swapExercise} onSync={() => session && void syncSession(session)}/>; } return <TrainingMethodExecution key={exercise.id} exercise={exercise} exerciseIndex={exerciseIndex} library={library} onChange={changeSet} onComplete={(item, set, completed) => void completeSet(item, set, completed)} onAdd={(item) => void addSet(item)} onRemove={(item, set) => void removeSet(item, set)} onSwap={swapExercise} onSync={() => session && void syncSession(session)}/>; })}
    {message && <p className="error" role="alert">{message}</p>}<Button className="finish" onClick={() => void finish()} disabled={saving}>{saving ? "FINALIZANDO..." : "FINALIZAR TREINO"}</Button><button className="text-button" onClick={() => void cancel(session)} disabled={saving}>Cancelar treino</button>
  </AppShell>;

  return <AppShell><header><p className="eyebrow">SESSÃO</p><h1>Qual treino vamos fazer?</h1><Button onClick={() => openBuilder()}><Plus size={16}/> NOVO TREINO</Button></header>
    {message && <p className={message.includes("sucesso") ? "success" : "error"} role="status">{message}</p>}
    {loadError && <ErrorState message={loadError} onRetry={() => void load()}/>} {loading && <Loading/>}
    {!loading && active && <Card><span>TREINO EM ANDAMENTO</span><h2>{active.workoutName}</h2><p>Há uma sessão ativa salva. Resolva-a antes de iniciar outra.</p><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Button onClick={() => { setSession(active); setClock(Date.now()); }}>RETOMAR</Button><Button className="outline" onClick={() => void cancel(active)} disabled={saving}>CANCELAR SESSÃO</Button></div></Card>}
    {methodTargetId && <MethodSelector methods={methods} currentId={draft.find((item) => item.id === methodTargetId)?.methodSnapshot?.id} onClose={() => setMethodTargetId(null)} onSelect={(method) => chooseMethod(methodTargetId, method)}/>}
    {!loading && builder !== undefined && <Card className="workout-builder-card"><div className="builder-title"><div><span>{builder ? "EDIÇÃO" : "NOVO TREINO"}</span><h2>{builder ? "Editar treino" : "Monte seu treino"}</h2><p>Adicione os exercícios e salve quando terminar.</p></div><button type="button" className="text-button" onClick={() => setBuilder(undefined)}>Fechar</button></div>
      {!library.length ? <div className="empty"><strong>Biblioteca ainda não foi importada.</strong><span>Peça ao administrador para importar a biblioteca no painel administrativo.</span>{admin && <Button onClick={() => void importLibrary()} disabled={importing}>{importing ? "IMPORTANDO..." : "IMPORTAR 202 EXERCÍCIOS"}</Button>}</div> : <form className="workout-builder" onSubmit={saveWorkout}>
        <div className="form-grid workout-info"><label>Nome do treino<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Treino A"/></label><label>Título<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Peito e tríceps"/></label><label className="workout-description">Descrição<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Opcional"/></label></div>
        <section className="builder-section"><div className="builder-section-title"><div><span>1</span><div><h3>Adicionar exercício</h3><p>Pesquise e adicione cada exercício.</p></div></div></div><div className="library-filters"><label><span className="sr-only">Pesquisar exercícios</span><span className="search-input"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, inglês ou alias"/></span></label><label>Grupo<select value={group} onChange={(event) => setGroup(event.target.value)}><option value="">Todos os grupos</option>{exerciseMuscleGroups.map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="exercise-picker">{filteredLibrary.map((item) => { const added = draft.some((candidate) => candidate.exerciseId === item.id); return <article key={item.id} className={`library-item ${added ? "selected" : ""}`}><div><strong>{item.name}</strong><small>{item.muscleGroup}</small></div><div>{item.videoUrl && <a className="video-link" href={item.videoUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Vídeo</a>}<button type="button" className={`exercise-add-button ${added ? "added" : ""}`} onClick={() => addExercise(item)} disabled={added}>{added ? <><Check size={16}/> ADICIONADO</> : <><Plus size={16}/> ADICIONAR EXERCÍCIO</>}</button></div></article>; })}</div>{!filteredLibrary.length && <Empty title="Nenhum exercício encontrado" detail="Tente outro nome ou remova os filtros."/>}</section>
        <section className="builder-section">
          <div className="builder-section-title"><div><span>2</span><div><h3>Exercícios adicionados <b>{draft.length}</b></h3><p>Escolha um método, ajuste os parâmetros e finalize cada exercício para recolhê-lo.</p></div></div></div>
          {!draft.length && <Empty title="Nenhum exercício adicionado" detail="Use Adicionar exercício na biblioteca acima."/>}
          <div className="workout-draft-list">
            {draft.map((item, index) => {
              const method = item.methodSnapshot ?? snapshotMethod(normalTrainingMethod());
              const catalogMethod = methods.find((candidate) => candidate.id === method.id);
              const collapsed = collapsedDraftIds.has(item.id);
              return <div className={`card workout-draft-item ${collapsed ? "is-collapsed" : ""}`} key={item.id}>
                <div className="row workout-draft-header">
                  <div className="workout-draft-name"><span>{index + 1}</span><div><strong>{item.name}</strong>{collapsed && <small><Check size={13}/> Finalizado</small>}</div></div>
                  <span className="workout-draft-controls"><button type="button" className="draft-order-button" onClick={() => moveExercise(index, -1)} disabled={index === 0} aria-label={`Mover ${item.name} para cima`}>↑</button><button type="button" className="draft-order-button" onClick={() => moveExercise(index, 1)} disabled={index === draft.length - 1} aria-label={`Mover ${item.name} para baixo`}>↓</button><button type="button" className="draft-remove-button" onClick={() => removeDraftExercise(item.id)}>Remover</button></span>
                </div>
                {collapsed ? <div className="draft-collapsed-summary">
                  <div className="draft-summary-chips">
                    <span className="draft-method-chip">{method.name}</span>
                    {method.capabilities.sets && <span><b>{item.sets}</b> séries</span>}
                    {method.capabilities.reps && <span><b>{item.repsMin}–{item.repsMax}</b> repetições</span>}
                    {method.capabilities.rest && <span><b>{item.restSeconds}s</b> descanso</span>}
                    {method.capabilities.load && item.suggestedLoad !== undefined && <span><b>{item.suggestedLoad} kg</b> carga</span>}
                  </div>
                  <button type="button" className="draft-edit-button" onClick={() => setDraftCollapsed(item.id, false)} aria-expanded="false"><Pencil size={15}/> EDITAR</button>
                </div> : <>
                  <div className="method-summary"><div><small>Método</small><strong>{method.name}</strong>{catalogMethod?.active === false && <span className="method-disabled">Desativado para novos treinos; snapshot preservado.</span>}</div><button type="button" className="method-change-button" disabled={Boolean(item.groupId)} onClick={() => setMethodTargetId(item.id)}>{item.groupId ? "Definido pelo grupo" : "ALTERAR MÉTODO"}</button></div>
                  <div className="form-grid">{method.capabilities.sets && <label>Séries<input type="number" min="1" step="1" value={item.sets} onChange={(event) => updateDraft(item.id, { sets: Number(event.target.value) })}/></label>}{method.capabilities.rest && <label>Descanso (s)<input type="number" min="0" step="1" value={item.restSeconds} onChange={(event) => updateDraft(item.id, { restSeconds: Number(event.target.value) })}/></label>}{method.capabilities.reps && <><label>Repetições mín.<input type="number" min="1" step="1" value={item.repsMin} onChange={(event) => updateDraft(item.id, { repsMin: Number(event.target.value) })}/></label><label>Repetições máx.<input type="number" min="1" step="1" value={item.repsMax} onChange={(event) => updateDraft(item.id, { repsMax: Number(event.target.value) })}/></label></>}{method.capabilities.load && <label>Carga sugerida (kg)<input type="number" min="0" step="0.1" value={item.suggestedLoad ?? ""} onChange={(event) => updateDraft(item.id, { suggestedLoad: event.target.value === "" ? undefined : Number(event.target.value) })}/></label>}<label>Observação<textarea value={item.notes ?? ""} onChange={(event) => updateDraft(item.id, { notes: event.target.value || undefined })}/></label></div>
                  {item.methodConfig && <MethodConfigEditor method={method} config={item.methodConfig} onChange={(methodConfig) => updateDraft(item.id, { methodConfig })}/>}<div className="draft-finish-row"><button type="button" className="draft-finish-button" onClick={() => finishDraftExercise(item)}><Check size={17}/> FINALIZAR EXERCÍCIO</button></div>
                </>}
              </div>;
            })}
          </div>
        </section>
        <details className="builder-section group-builder">
          <summary className="builder-section-title group-builder-summary"><div><span>3</span><div><h3>Combinar exercícios{draftGroups.length > 0 && <b>{draftGroups.length}</b>}</h3><p>Crie bi-sets, tri-sets, supersets e sequências maiores.</p></div></div><span className="group-builder-toggle"><ChevronDown size={19}/></span></summary>
          <div className="group-builder-content">{draftGroups.map((item) => <div className="group-card" key={item.id}><div><strong>{item.name}</strong><small>{item.exerciseIds.map((id) => draft.find((exercise) => exercise.id === id)?.name).filter(Boolean).join(" → ")}</small></div><button type="button" className="text-button danger-text" onClick={() => removeExerciseGroup(item.id)}>Remover grupo</button></div>)}<div className="group-create"><label>Método combinado<select value={groupMethodId} onChange={(event) => { setGroupMethodId(event.target.value); setGroupMembers([]); }}><option value="">Selecione</option>{methods.filter((item) => item.active && item.engine === "group").map((item) => <option value={item.id} key={item.id}>{item.name} ({item.exerciseRules.minExercises}–{item.exerciseRules.maxExercises})</option>)}</select></label><fieldset><legend>Exercícios do grupo, na ordem</legend>{draft.filter((item) => !item.groupId).map((item) => <label className="method-check" key={item.id}><input type="checkbox" checked={groupMembers.includes(item.id)} onChange={(event) => setGroupMembers((items) => event.target.checked ? [...items, item.id] : items.filter((id) => id !== item.id))}/>{item.name}</label>)}</fieldset><Button type="button" className="outline" onClick={addExerciseGroup} disabled={!groupMethodId}>CRIAR GRUPO</Button></div></div>
        </details>
        <div className="workout-form-actions"><Button type="submit" className="workout-submit" disabled={saving}>{saving ? "SALVANDO..." : builder ? "SALVAR ALTERAÇÕES" : `CRIAR TREINO (${draft.length})`}</Button><button type="button" className="text-button" onClick={() => setBuilder(undefined)} disabled={saving}>Cancelar</button></div>
      </form>}
    </Card>}
    {!loading && <><h2>Treinos ativos</h2><div className="cards">{activePlans.map((workout) => {
      const expanded = expandedPlanIds.has(workout.id);
      const exerciseListId = `workout-exercises-${workout.id}`;
      return <Card className={`workout-plan-card ${expanded ? "is-expanded" : ""}`} key={workout.id}>
        <button type="button" className="workout-plan-toggle" onClick={() => togglePlanExercises(workout.id)} aria-expanded={expanded} aria-controls={exerciseListId}>
          <div className="workout-plan-header"><div><span className="workout-plan-label">TREINO ATIVO</span><h2>{workout.title}</h2></div><div className="workout-plan-count-group">{Boolean(completedCounts.get(workout.id)) && <span className="workout-plan-count workout-plan-done-count"><History size={11}/> {completedCounts.get(workout.id)}x feito</span>}<span className="workout-plan-count">{workout.exercises.length} {workout.exercises.length === 1 ? "exercício" : "exercícios"}</span><span className="workout-plan-chevron" aria-hidden="true"><ChevronDown size={20}/></span></div></div>
          {workout.description && <p className="workout-plan-description">{workout.description}</p>}
        </button>
        {expanded && <section className="workout-exercise-list" id={exerciseListId} aria-label={`Exercícios de ${workout.title}`}>
          <div className="workout-exercise-list-title"><span>EXERCÍCIOS DO TREINO</span><small>Clique no cabeçalho para recolher</small></div>
          <ol>{workout.exercises.map((exercise, index) => <li key={exercise.id}><span className="workout-exercise-number">{index + 1}</span><div className="workout-exercise-detail"><strong>{exercise.name}</strong><div className="workout-exercise-meta"><span>{exercise.methodSnapshot?.name ?? "Séries normais"}</span><span>{exercise.sets} {exercise.sets === 1 ? "série" : "séries"}</span><span>{exercise.repsMin}–{exercise.repsMax} repetições</span><span>{exercise.restSeconds}s de descanso</span>{exercise.suggestedLoad !== undefined && <span>{exercise.suggestedLoad} kg</span>}</div>{exercise.notes && <small>{exercise.notes}</small>}</div></li>)}</ol>
        </section>}
        <div className="plan-actions workout-plan-actions"><Button className="workout-start-button" onClick={() => void start(workout)} disabled={Boolean(active)} aria-label="Iniciar treino"><Play size={17} fill="currentColor"/> <span className="action-label">INICIAR</span></Button><div className="workout-secondary-actions"><button className="workout-action-button" onClick={() => openBuilder(workout)} aria-label="Editar treino"><Pencil size={16}/> <span className="action-label">Editar</span></button><button className="workout-action-button" onClick={async () => { try { await workouts.duplicate(workout); await reloadPlans(); } catch { setMessage("Não foi possível duplicar o treino."); } }} aria-label="Duplicar treino"><Copy size={16}/> <span className="action-label">Duplicar</span></button><button className="workout-action-button" onClick={async () => { try { await workouts.save(workoutInput(workout, false), workout.id); await reloadPlans(); } catch { setMessage("Não foi possível arquivar o treino."); } }} aria-label="Arquivar treino"><Archive size={16}/> <span className="action-label">Arquivar</span></button></div></div>
      </Card>;
    })}</div>{!activePlans.length && builder === undefined && <Empty title="Nenhum treino ativo" detail="Use Novo treino para montar o seu."/>}
      {archivedPlans.length > 0 && <section className="archived-section"><h2>Treinos arquivados</h2><div className="cards">{archivedPlans.map((workout) => <Card key={workout.id}><h2>{workout.title}</h2><p>{workout.description}</p><small>{workout.exercises.length} exercícios</small><div className="plan-actions"><Button className="outline" onClick={async () => { try { await workouts.save(workoutInput(workout, true), workout.id); await reloadPlans(); } catch { setMessage("Não foi possível restaurar o treino."); } }}>RESTAURAR</Button><button className="text-button danger-text" onClick={async () => { if (!confirm(`Excluir definitivamente ${workout.name}? As sessões históricas serão preservadas.`)) return; try { await workouts.remove(workout.id); await reloadPlans(); } catch { setMessage("Não foi possível excluir o treino."); } }}>Excluir definitivamente</button></div></Card>)}</div></section>}</>}
  </AppShell>;
}

export default function Training() { return <Guard><Work/></Guard>; }
