import type { TrainingSet, WorkoutSession } from "@/types";
import { isWorkingSet } from "@/lib/training-methods";

export interface BestSet {
  load: number;
  reps: number;
  volume: number;
}

export interface ExerciseSessionAggregate {
  sessionId: string;
  exerciseId: string;
  name: string;
  date: Date;
  maxLoad: number;
  totalReps: number;
  totalVolume: number;
  completedSets: number;
  bestSet: BestSet;
  sets: TrainingSet[];
}

export interface ExerciseRecord {
  exerciseId: string;
  name: string;
  maxLoad: number;
  maxLoadDate: Date;
  maxReps: number;
  maxRepsDate: Date;
  maxSessionVolume: number;
  maxSessionVolumeDate: Date;
  bestSet: BestSet;
  bestSetDate: Date;
}

export interface RecordEvent {
  exerciseId: string;
  name: string;
  kind: "load" | "reps" | "volume";
  value: number;
}

type TimestampLike = { toDate?: () => Date; seconds?: number } | Date | undefined;

export function timestampDate(value: TimestampLike) {
  if (value instanceof Date) return value;
  if (value?.toDate) return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  return new Date(0);
}

const normalizedName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

export function exerciseIdentity(exercise: { exerciseId?: string; name: string }) {
  return exercise.exerciseId || `legacy:${normalizedName(exercise.name)}`;
}

// Uma série concluída pertence ao exercício realmente executado (actualExerciseId/Name, gravado
// no momento da conclusão), nunca ao exercício que estava planejado na ficha caso ele tenha sido
// trocado depois. Séries sem esse carimbo (sessões antigas, ou séries concluídas antes de
// qualquer troca) usam o SessionExercise atual como já acontecia.
function executedIdentity(exercise: WorkoutSession["exercises"][number], set: TrainingSet) {
  const exerciseId = set.actualExerciseId ?? exercise.exerciseId;
  const name = set.actualExerciseName ?? exercise.name;
  return { id: exerciseIdentity({ exerciseId, name }), name };
}

// Uma sessão pode conter, dentro do mesmo SessionExercise, séries de dois exercícios diferentes
// (antes e depois de uma troca no meio da execução). Por isso o agrupamento é feito por
// identidade real da série, não por SessionExercise — nunca mistura histórico entre exercícios e
// nunca reescreve o que já foi executado.
export function aggregateExerciseSession(session: WorkoutSession): ExerciseSessionAggregate[] {
  if (session.status !== "completed") return [];
  const date = timestampDate(session.startedAt);
  return session.exercises.flatMap((exercise) => {
    const groups = new Map<string, { name: string; sets: TrainingSet[] }>();
    for (const set of exercise.sets) {
      if (!set.completed || !isWorkingSet(set)) continue;
      const { id, name } = executedIdentity(exercise, set);
      const bucket = groups.get(id) ?? { name, sets: [] };
      bucket.sets.push(set);
      groups.set(id, bucket);
    }
    return [...groups.entries()].map(([exerciseId, { name, sets }]) => {
      const bestSet = sets.reduce<BestSet>((best, set) => {
        const candidate = { load: set.load, reps: set.reps, volume: set.load * set.reps };
        return candidate.load > best.load || (candidate.load === best.load && candidate.reps > best.reps) ? candidate : best;
      }, { load: 0, reps: 0, volume: 0 });
      return {
        sessionId: session.id,
        exerciseId,
        name,
        date,
        maxLoad: Math.max(...sets.map((set) => set.load)),
        totalReps: sets.reduce((sum, set) => sum + set.reps, 0),
        totalVolume: sets.reduce((sum, set) => sum + set.load * set.reps, 0),
        completedSets: sets.length,
        bestSet,
        sets,
      };
    });
  });
}

export function calculateExerciseHistory(sessions: WorkoutSession[], exerciseId: string, exerciseName?: string) {
  const legacyId = exerciseName ? `legacy:${normalizedName(exerciseName)}` : "";
  return sessions
    .flatMap(aggregateExerciseSession)
    .filter((item) => item.exerciseId === exerciseId || (legacyId && item.exerciseId === legacyId))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Carga usada por posição de série (blockIndex) na sessão concluída mais recente deste
// exercício. Usada para pré-preencher a próxima sessão com a última carga real, em vez de
// reiniciar sempre da carga sugerida do treino. Retorna -1 nas posições sem histórico.
export function lastUsedLoadsByBlock(sessions: WorkoutSession[], exerciseId: string, exerciseName?: string): number[] {
  const latest = calculateExerciseHistory(sessions, exerciseId, exerciseName).at(-1);
  if (!latest) return [];
  const byBlock = new Map<number, number>();
  for (const set of latest.sets) {
    if (set.stageIndex !== 0) continue;
    byBlock.set(set.blockIndex ?? 0, set.load);
  }
  if (!byBlock.size) return [];
  return Array.from({ length: Math.max(...byBlock.keys()) + 1 }, (_, index) => byBlock.get(index) ?? -1);
}

export function calculateExerciseRecords(sessions: WorkoutSession[]) {
  const records = new Map<string, ExerciseRecord>();
  for (const aggregate of sessions.flatMap(aggregateExerciseSession).sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const current = records.get(aggregate.exerciseId);
    if (!current) {
      records.set(aggregate.exerciseId, {
        exerciseId: aggregate.exerciseId,
        name: aggregate.name,
        maxLoad: aggregate.maxLoad,
        maxLoadDate: aggregate.date,
        maxReps: Math.max(...aggregate.sets.map((set) => set.reps)),
        maxRepsDate: aggregate.date,
        maxSessionVolume: aggregate.totalVolume,
        maxSessionVolumeDate: aggregate.date,
        bestSet: aggregate.bestSet,
        bestSetDate: aggregate.date,
      });
      continue;
    }
    if (aggregate.maxLoad > current.maxLoad) {
      current.maxLoad = aggregate.maxLoad;
      current.maxLoadDate = aggregate.date;
    }
    const maxReps = Math.max(...aggregate.sets.map((set) => set.reps));
    if (maxReps > current.maxReps) {
      current.maxReps = maxReps;
      current.maxRepsDate = aggregate.date;
    }
    if (aggregate.totalVolume > current.maxSessionVolume) {
      current.maxSessionVolume = aggregate.totalVolume;
      current.maxSessionVolumeDate = aggregate.date;
    }
    if (aggregate.bestSet.load > current.bestSet.load || (aggregate.bestSet.load === current.bestSet.load && aggregate.bestSet.reps > current.bestSet.reps)) {
      current.bestSet = aggregate.bestSet;
      current.bestSetDate = aggregate.date;
    }
    current.name = aggregate.name;
  }
  return records;
}

export function detectNewRecords(previousSessions: WorkoutSession[], completedSession: WorkoutSession): RecordEvent[] {
  const previous = calculateExerciseRecords(previousSessions);
  const events: RecordEvent[] = [];
  for (const aggregate of aggregateExerciseSession({ ...completedSession, status: "completed" })) {
    const old = previous.get(aggregate.exerciseId);
    if (!old || aggregate.maxLoad > old.maxLoad) events.push({ exerciseId: aggregate.exerciseId, name: aggregate.name, kind: "load", value: aggregate.maxLoad });
    const maxReps = Math.max(...aggregate.sets.map((set) => set.reps));
    if (old && maxReps > old.maxReps) events.push({ exerciseId: aggregate.exerciseId, name: aggregate.name, kind: "reps", value: maxReps });
    if (old && aggregate.totalVolume > old.maxSessionVolume) events.push({ exerciseId: aggregate.exerciseId, name: aggregate.name, kind: "volume", value: aggregate.totalVolume });
  }
  return events;
}

export function calculateMonthlyStats(sessions: WorkoutSession[], reference = new Date()) {
  const filtered = sessions.filter((session) => {
    const date = timestampDate(session.startedAt);
    return session.status === "completed" && date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
  });
  return {
    workouts: filtered.length,
    volume: filtered.reduce((sum, session) => sum + session.totalVolume, 0),
    sets: filtered.reduce((sum, session) => sum + session.totalSets, 0),
  };
}

export function mondayKey(date: Date) {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - day);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function calculateTrainingStreak(sessions: WorkoutSession[], reference = new Date()) {
  const trainedWeeks = new Set(sessions.filter((item) => item.status === "completed").map((item) => mondayKey(timestampDate(item.startedAt))));
  const cursor = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  if (!trainedWeeks.has(mondayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 7);
    if (!trainedWeeks.has(mondayKey(cursor))) return 0;
  }
  let streak = 0;
  while (trainedWeeks.has(mondayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

export function calculateEvolution(first: number, current: number) {
  return {
    absolute: current - first,
    percentage: first === 0 ? null : ((current - first) / first) * 100,
  };
}
