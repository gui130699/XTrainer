import { isWorkingSet } from "@/lib/training-methods";
import { aggregateExerciseSession, mondayKey, timestampDate, type ExerciseRecord, type RecordEvent } from "@/lib/training-analytics";
import type { BodyWeight, Exercise, WorkoutSession } from "@/types";

export interface ExerciseUsageSummary {
  exerciseId: string;
  name: string;
  sessionsCount: number;
}

export interface MuscleGroupSummary {
  muscleGroup: string;
  effectiveSets: number;
}

export interface TrainingMethodUsageSummary {
  methodId: string;
  methodName: string;
  engine: string;
  uses: number;
}

export interface TimelineRecordEvent extends RecordEvent {
  sessionId: string;
  date: Date;
}

export interface ExerciseProgression {
  exerciseId: string;
  name: string;
  first: number;
  last: number;
}

export interface ExerciseGain {
  exerciseId: string;
  name: string;
  first: number;
  last: number;
  absolute: number;
  percentage: number | null;
}

export interface WeightChange {
  start: number;
  end: number;
  change: number;
}

// Uma sessão só conta para um exercício se tiver ao menos uma série efetiva concluída
// (aggregateExerciseSession já resolve a identidade real pós-troca e ignora puladas).
export function calculateExerciseUsage(sessions: WorkoutSession[]): ExerciseUsageSummary[] {
  const bySessions = new Map<string, { name: string; sessionIds: Set<string> }>();
  for (const session of sessions) {
    for (const aggregate of aggregateExerciseSession(session)) {
      const current = bySessions.get(aggregate.exerciseId) ?? { name: aggregate.name, sessionIds: new Set<string>() };
      current.sessionIds.add(session.id);
      current.name = aggregate.name;
      bySessions.set(aggregate.exerciseId, current);
    }
  }
  return [...bySessions.entries()]
    .map(([exerciseId, { name, sessionIds }]) => ({ exerciseId, name, sessionsCount: sessionIds.size }))
    .sort((a, b) => b.sessionsCount - a.sessionsCount || a.name.localeCompare(b.name, "pt-BR"));
}

// Grupo muscular mais treinado = maior número de séries efetivas concluídas, nunca volume em kg.
export function calculateMuscleGroupDistribution(sessions: WorkoutSession[], library: Exercise[]): MuscleGroupSummary[] {
  const muscleGroupById = new Map(library.map((item) => [item.id, item.muscleGroup]));
  const counts = new Map<string, number>();
  for (const session of sessions) {
    for (const aggregate of aggregateExerciseSession(session)) {
      const muscleGroup = muscleGroupById.get(aggregate.exerciseId) ?? "Outros";
      counts.set(muscleGroup, (counts.get(muscleGroup) ?? 0) + aggregate.completedSets);
    }
  }
  return [...counts.entries()].map(([muscleGroup, effectiveSets]) => ({ muscleGroup, effectiveSets })).sort((a, b) => b.effectiveSets - a.effectiveSets);
}

// Conta uma ocorrência por SessionExercise com ao menos uma série efetiva concluída, nunca por
// estágio (um drop-set com 3 drops é 1 uso, não 3).
export function calculateMethodUsage(sessions: WorkoutSession[]): TrainingMethodUsageSummary[] {
  const usage = new Map<string, { methodName: string; engine: string; uses: number }>();
  for (const session of sessions) {
    if (session.status !== "completed") continue;
    for (const exercise of session.exercises) {
      const method = exercise.target.methodSnapshot;
      if (!method) continue;
      const hasEffectiveSet = exercise.sets.some((set) => set.completed && isWorkingSet(set));
      if (!hasEffectiveSet) continue;
      const current = usage.get(method.id) ?? { methodName: method.name, engine: method.engine, uses: 0 };
      current.uses += 1;
      usage.set(method.id, current);
    }
  }
  return [...usage.entries()].map(([methodId, { methodName, engine, uses }]) => ({ methodId, methodName, engine, uses })).sort((a, b) => b.uses - a.uses);
}

// Timeline determinística de PRs: processa as sessões em ordem cronológica e emite um evento só
// quando o valor realmente supera o máximo histórico anterior (nunca o máximo dentro de um
// período isolado). O primeiro registro de um exercício sempre conta como recorde de carga,
// igual ao comportamento já usado ao finalizar um treino (detectNewRecords); reps/volume só
// contam como recorde a partir do segundo registro em diante.
export function buildRecordTimeline(sessions: WorkoutSession[]): TimelineRecordEvent[] {
  const events: TimelineRecordEvent[] = [];
  const records = new Map<string, ExerciseRecord>();
  const aggregates = sessions.flatMap(aggregateExerciseSession).sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const aggregate of aggregates) {
    const current = records.get(aggregate.exerciseId);
    const maxReps = Math.max(...aggregate.sets.map((set) => set.reps));
    if (!current) {
      records.set(aggregate.exerciseId, {
        exerciseId: aggregate.exerciseId, name: aggregate.name,
        maxLoad: aggregate.maxLoad, maxLoadDate: aggregate.date,
        maxReps, maxRepsDate: aggregate.date,
        maxSessionVolume: aggregate.totalVolume, maxSessionVolumeDate: aggregate.date,
        bestSet: aggregate.bestSet, bestSetDate: aggregate.date,
      });
      events.push({ exerciseId: aggregate.exerciseId, name: aggregate.name, kind: "load", value: aggregate.maxLoad, sessionId: aggregate.sessionId, date: aggregate.date });
      continue;
    }
    if (aggregate.maxLoad > current.maxLoad) {
      current.maxLoad = aggregate.maxLoad;
      current.maxLoadDate = aggregate.date;
      events.push({ exerciseId: aggregate.exerciseId, name: aggregate.name, kind: "load", value: aggregate.maxLoad, sessionId: aggregate.sessionId, date: aggregate.date });
    }
    if (maxReps > current.maxReps) {
      current.maxReps = maxReps;
      current.maxRepsDate = aggregate.date;
      events.push({ exerciseId: aggregate.exerciseId, name: aggregate.name, kind: "reps", value: maxReps, sessionId: aggregate.sessionId, date: aggregate.date });
    }
    if (aggregate.totalVolume > current.maxSessionVolume) {
      current.maxSessionVolume = aggregate.totalVolume;
      current.maxSessionVolumeDate = aggregate.date;
      events.push({ exerciseId: aggregate.exerciseId, name: aggregate.name, kind: "volume", value: aggregate.totalVolume, sessionId: aggregate.sessionId, date: aggregate.date });
    }
    current.name = aggregate.name;
  }
  return events;
}

// Evolução ≠ recorde: compara o primeiro e o último registro efetivo dentro do período (mês/ano),
// não o histórico completo. Um PR pode não mudar a evolução do período, e vice-versa.
export function calculateExerciseProgression(sessionsInPeriod: WorkoutSession[]): Map<string, ExerciseProgression> {
  const byExercise = new Map<string, ExerciseProgression>();
  const aggregates = sessionsInPeriod.flatMap(aggregateExerciseSession).sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const aggregate of aggregates) {
    const current = byExercise.get(aggregate.exerciseId);
    if (!current) byExercise.set(aggregate.exerciseId, { exerciseId: aggregate.exerciseId, name: aggregate.name, first: aggregate.maxLoad, last: aggregate.maxLoad });
    else { current.last = aggregate.maxLoad; current.name = aggregate.name; }
  }
  return byExercise;
}

function toGain(item: ExerciseProgression): ExerciseGain {
  const absolute = item.last - item.first;
  return { ...item, absolute, percentage: item.first === 0 ? null : (absolute / item.first) * 100 };
}

export function findBiggestAbsoluteGain(progression: Map<string, ExerciseProgression>): ExerciseGain | null {
  let best: ExerciseGain | null = null;
  for (const item of progression.values()) {
    const gain = toGain(item);
    if (!best || gain.absolute > best.absolute) best = gain;
  }
  return best;
}

export function findBiggestPercentageGain(progression: Map<string, ExerciseProgression>): ExerciseGain | null {
  let best: ExerciseGain | null = null;
  for (const item of progression.values()) {
    const gain = toGain(item);
    if (gain.percentage === null) continue;
    if (!best || (best.percentage !== null && gain.percentage > best.percentage)) best = gain;
  }
  return best;
}

// Requer ao menos dois registros de peso dentro do período; caso contrário não há o que comparar.
export function calculatePeriodWeightChange(weights: BodyWeight[], start: Date, end: Date): WeightChange | null {
  const relevant = weights
    .filter((item) => { const date = new Date(`${item.date}T12:00:00`); return date.getTime() >= start.getTime() && date.getTime() < end.getTime(); })
    .sort((a, b) => a.date.localeCompare(b.date));
  if (relevant.length < 2) return null;
  const first = relevant[0].weight;
  const last = relevant.at(-1)!.weight;
  return { start: first, end: last, change: last - first };
}

export function calculatePeriodTrainingDuration(sessions: WorkoutSession[]): { totalSeconds: number; averageSeconds: number } {
  const completed = sessions.filter((item) => item.status === "completed");
  const totalSeconds = completed.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0);
  return { totalSeconds, averageSeconds: completed.length ? totalSeconds / completed.length : 0 };
}

// Maior sequência de semanas consecutivas com pelo menos um treino concluído, dentro do conjunto
// de sessões informado (tipicamente as sessões de um ano).
export function calculateLongestWeeklyStreak(sessions: WorkoutSession[]): number {
  const weeks = [...new Set(sessions.filter((item) => item.status === "completed").map((item) => mondayKey(timestampDate(item.startedAt))))].sort();
  let longest = 0;
  let current = 0;
  let previousTime: number | null = null;
  for (const key of weeks) {
    const time = new Date(`${key}T12:00:00`).getTime();
    current = previousTime !== null && time - previousTime === 7 * 86400000 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previousTime = time;
  }
  return longest;
}

export interface MonthlyTrainingSummary {
  year: number;
  month: number;
  sessionsCount: number;
  trainedDays: number;
  completedSets: number;
  effectiveSets: number;
  volume: number;
  durationSeconds: number;
  averageDurationSeconds: number;
  averageSessionsPerWeek: number;
  newRecords: TimelineRecordEvent[];
  topExercise: ExerciseUsageSummary | null;
  topExercises: ExerciseUsageSummary[];
  topMuscleGroup: MuscleGroupSummary | null;
  methodUsage: TrainingMethodUsageSummary[];
  topMethod: TrainingMethodUsageSummary | null;
  volumeChangePercent: number | null;
  previousVolume: number;
  frequencyChangePercent: number | null;
  previousSessionsCount: number;
  weight: WeightChange | null;
}

export interface MonthlySummaryInput {
  year: number;
  month: number;
  currentSessions: WorkoutSession[];
  previousSessions: WorkoutSession[];
  recordBaselineSessions: WorkoutSession[];
  library: Exercise[];
  weights: BodyWeight[];
}

export function calculateMonthlySummary(input: MonthlySummaryInput): MonthlyTrainingSummary {
  const { year, month, library, weights } = input;
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);
  const completed = input.currentSessions.filter((item) => item.status === "completed");
  const previousCompleted = input.previousSessions.filter((item) => item.status === "completed");

  const aggregates = completed.flatMap(aggregateExerciseSession);
  const effectiveSets = aggregates.reduce((sum, item) => sum + item.completedSets, 0);
  const completedSets = completed.reduce((sum, item) => sum + item.totalSets, 0);
  const volume = completed.reduce((sum, item) => sum + item.totalVolume, 0);
  const { totalSeconds: durationSeconds, averageSeconds: averageDurationSeconds } = calculatePeriodTrainingDuration(completed);
  const trainedDays = new Set(completed.map((item) => { const date = timestampDate(item.startedAt); return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; })).size;
  const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86400000);
  const averageSessionsPerWeek = daysInMonth > 0 ? completed.length / (daysInMonth / 7) : 0;

  const methodUsage = calculateMethodUsage(completed);
  const topExercises = calculateExerciseUsage(completed);
  const muscleGroups = calculateMuscleGroupDistribution(completed, library);

  const timeline = buildRecordTimeline(input.recordBaselineSessions);
  const newRecords = timeline.filter((event) => event.date.getTime() >= monthStart.getTime() && event.date.getTime() < monthEnd.getTime());

  const previousVolume = previousCompleted.reduce((sum, item) => sum + item.totalVolume, 0);
  const previousSessionsCount = previousCompleted.length;

  return {
    year, month,
    sessionsCount: completed.length,
    trainedDays,
    completedSets,
    effectiveSets,
    volume,
    durationSeconds,
    averageDurationSeconds,
    averageSessionsPerWeek,
    newRecords,
    topExercise: topExercises[0] ?? null,
    topExercises: topExercises.slice(0, 5),
    topMuscleGroup: muscleGroups[0] ?? null,
    methodUsage,
    topMethod: methodUsage.find((item) => item.engine !== "normal") ?? null,
    volumeChangePercent: previousVolume > 0 ? ((volume - previousVolume) / previousVolume) * 100 : null,
    previousVolume,
    frequencyChangePercent: previousSessionsCount > 0 ? ((completed.length - previousSessionsCount) / previousSessionsCount) * 100 : null,
    previousSessionsCount,
    weight: calculatePeriodWeightChange(weights, monthStart, monthEnd),
  };
}

export interface YearlyTrainingSummary {
  year: number;
  sessionsCount: number;
  trainedDays: number;
  completedSets: number;
  effectiveSets: number;
  volume: number;
  durationSeconds: number;
  averageSessionsPerWeek: number;
  longestStreakWeeks: number;
  bestMonth: { month: number; sessionsCount: number } | null;
  bestVolumeMonth: { month: number; volume: number } | null;
  topExercise: ExerciseUsageSummary | null;
  topExercises: ExerciseUsageSummary[];
  topMuscleGroup: MuscleGroupSummary | null;
  muscleGroupDistribution: MuscleGroupSummary[];
  newRecords: TimelineRecordEvent[];
  biggestAbsoluteGain: ExerciseGain | null;
  biggestPercentageGain: ExerciseGain | null;
  weight: WeightChange | null;
  methodUsage: TrainingMethodUsageSummary[];
  topMethod: TrainingMethodUsageSummary | null;
  distinctWorkouts: number;
}

export interface YearlySummaryInput {
  year: number;
  currentSessions: WorkoutSession[];
  recordBaselineSessions: WorkoutSession[];
  library: Exercise[];
  weights: BodyWeight[];
}

export function calculateYearlySummary(input: YearlySummaryInput): YearlyTrainingSummary {
  const { year, library, weights } = input;
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const completed = input.currentSessions.filter((item) => item.status === "completed");

  const aggregates = completed.flatMap(aggregateExerciseSession);
  const effectiveSets = aggregates.reduce((sum, item) => sum + item.completedSets, 0);
  const completedSets = completed.reduce((sum, item) => sum + item.totalSets, 0);
  const volume = completed.reduce((sum, item) => sum + item.totalVolume, 0);
  const { totalSeconds: durationSeconds } = calculatePeriodTrainingDuration(completed);
  const trainedDays = new Set(completed.map((item) => { const date = timestampDate(item.startedAt); return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; })).size;
  const averageSessionsPerWeek = completed.length / 52;

  const byMonth = new Map<number, { sessionsCount: number; volume: number }>();
  for (const session of completed) {
    const month = timestampDate(session.startedAt).getMonth();
    const current = byMonth.get(month) ?? { sessionsCount: 0, volume: 0 };
    current.sessionsCount += 1;
    current.volume += session.totalVolume;
    byMonth.set(month, current);
  }
  const monthEntries = [...byMonth.entries()];
  const bestMonthEntry = monthEntries.sort((a, b) => b[1].sessionsCount - a[1].sessionsCount)[0];
  const bestVolumeMonthEntry = [...monthEntries].sort((a, b) => b[1].volume - a[1].volume)[0];

  const methodUsage = calculateMethodUsage(completed);
  const topExercises = calculateExerciseUsage(completed);
  const muscleGroups = calculateMuscleGroupDistribution(completed, library);

  const timeline = buildRecordTimeline(input.recordBaselineSessions);
  const newRecords = timeline.filter((event) => event.date.getTime() >= yearStart.getTime() && event.date.getTime() < yearEnd.getTime());

  const progression = calculateExerciseProgression(completed);

  return {
    year,
    sessionsCount: completed.length,
    trainedDays,
    completedSets,
    effectiveSets,
    volume,
    durationSeconds,
    averageSessionsPerWeek,
    longestStreakWeeks: calculateLongestWeeklyStreak(completed),
    bestMonth: bestMonthEntry ? { month: bestMonthEntry[0], sessionsCount: bestMonthEntry[1].sessionsCount } : null,
    bestVolumeMonth: bestVolumeMonthEntry ? { month: bestVolumeMonthEntry[0], volume: bestVolumeMonthEntry[1].volume } : null,
    topExercise: topExercises[0] ?? null,
    topExercises: topExercises.slice(0, 5),
    topMuscleGroup: muscleGroups[0] ?? null,
    muscleGroupDistribution: muscleGroups,
    newRecords,
    biggestAbsoluteGain: findBiggestAbsoluteGain(progression),
    biggestPercentageGain: findBiggestPercentageGain(progression),
    weight: calculatePeriodWeightChange(weights, yearStart, yearEnd),
    methodUsage,
    topMethod: methodUsage.find((item) => item.engine !== "normal") ?? null,
    distinctWorkouts: new Set(completed.map((item) => item.workoutId)).size,
  };
}
