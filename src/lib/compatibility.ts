import { normalizeWorkoutMethod } from "@/lib/training-methods";
import type { BodyWeight, Exercise, PhysicalAssessment, TrainingSet, Workout, WorkoutSession } from "@/types";

type LegacyDocument = Record<string, unknown>;

const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const number = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const object = (value: unknown): LegacyDocument => value && typeof value === "object" && !Array.isArray(value) ? value as LegacyDocument : {};

export function normalizeExerciseDocument(id: string, raw: LegacyDocument): Exercise {
  return {
    ...raw,
    id,
    name: text(raw.name, "Exercício sem nome"),
    muscleGroup: text(raw.muscleGroup, "Outros"),
    aliases: Array.isArray(raw.aliases) ? raw.aliases.filter((item): item is string => typeof item === "string") : undefined,
    active: raw.active !== false,
  } as Exercise;
}

export function normalizeWorkoutDocument(id: string, raw: LegacyDocument): Workout {
  const name = text(raw.name, text(raw.title, "Treino sem nome"));
  return {
    ...raw,
    id,
    ownerId: text(raw.ownerId),
    name,
    title: text(raw.title, name),
    muscleGroups: Array.isArray(raw.muscleGroups) ? raw.muscleGroups : [],
    exercises: (Array.isArray(raw.exercises) ? raw.exercises : []).map((item) => normalizeWorkoutMethod(item as Workout["exercises"][number])),
    exerciseGroups: Array.isArray(raw.exerciseGroups) ? raw.exerciseGroups : [],
    active: raw.active !== false,
  } as Workout;
}

function normalizeSet(raw: unknown, index: number): TrainingSet {
  const data = object(raw);
  const load = number(data.load);
  const reps = number(data.reps);
  return {
    ...data,
    id: text(data.id, `legacy-set-${index}`),
    load,
    reps,
    completed: data.completed === true,
    volume: number(data.volume, load * reps),
  } as TrainingSet;
}

export function normalizeWorkoutSessionDocument(id: string, raw: LegacyDocument): WorkoutSession {
  const rawExercises = Array.isArray(raw.exercises) ? raw.exercises : [];
  const exercises = rawExercises.map((item, exerciseIndex) => {
    const data = object(item);
    const name = text(data.name, "Exercício antigo");
    const sets = (Array.isArray(data.sets) ? data.sets : []).map(normalizeSet);
    const target = object(data.target);
    const exerciseId = text(data.exerciseId, text(target.exerciseId));
    const itemId = text(data.id, `legacy-exercise-${exerciseIndex}`);
    return {
      ...data,
      id: itemId,
      exerciseId,
      name,
      order: number(data.order, exerciseIndex),
      target: normalizeWorkoutMethod({
        ...target,
        id: text(target.id, itemId),
        exerciseId,
        name,
        order: number(target.order, exerciseIndex),
        sets: number(target.sets, sets.length),
        repsMin: number(target.repsMin),
        repsMax: number(target.repsMax),
        restSeconds: number(target.restSeconds),
      } as Workout["exercises"][number]),
      sets,
    };
  });
  const completedSets = exercises.flatMap((item) => item.sets).filter((item) => item.completed);
  const status = raw.status === "active" || raw.status === "completed" || raw.status === "cancelled"
    ? raw.status
    : raw.endedAt ? "completed" : "active";
  return {
    ...raw,
    id,
    ownerId: text(raw.ownerId),
    workoutId: text(raw.workoutId),
    workoutName: text(raw.workoutName, "Treino antigo"),
    exercises,
    exerciseGroups: Array.isArray(raw.exerciseGroups) ? raw.exerciseGroups : [],
    totalVolume: number(raw.totalVolume, completedSets.reduce((sum, item) => sum + item.load * item.reps, 0)),
    totalSets: number(raw.totalSets, completedSets.length),
    status,
  } as WorkoutSession;
}

export function normalizeBodyWeightDocument(id: string, raw: LegacyDocument): BodyWeight {
  return {
    ...raw,
    id,
    ownerId: text(raw.ownerId),
    date: text(raw.date),
    weight: number(raw.weight),
    source: raw.source === "assessment" ? "assessment" : raw.source === "manual" ? "manual" : undefined,
  } as BodyWeight;
}

export function normalizeAssessmentDocument(id: string, raw: LegacyDocument): PhysicalAssessment {
  const measurements = object(raw.measurements);
  const inferredType = Object.keys(measurements).length ? "complete" : "quick";
  const type = raw.type === "quick" || raw.type === "complete" || raw.type === "advanced" ? raw.type : inferredType;
  return {
    ...raw,
    id,
    ownerId: text(raw.ownerId),
    date: text(raw.date),
    type,
    measurements,
    skinfolds: raw.skinfolds && typeof raw.skinfolds === "object" ? object(raw.skinfolds) : undefined,
  } as PhysicalAssessment;
}
