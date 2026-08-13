import type { Timestamp } from "firebase/firestore";
export type Id = string;
export interface UserProfile { uid: Id; name: string; email: string; role: "admin" | "user"; birthDate?: string; height?: number; sex?: string; goal?: string; photoURL?: string; createdAt?: Timestamp }
export interface Exercise { id: Id; name: string; muscleGroup: string; muscleSubgroup?: string; equipment?: string; videoUrl?: string; description?: string; instructions?: string; notes?: string; active: boolean; createdAt?: Timestamp; updatedAt?: Timestamp }
export interface WorkoutExercise { id: Id; exerciseId: Id; name: string; order: number; sets: number; repsMin: number; repsMax: number; restSeconds: number; suggestedLoad?: number; notes?: string }
export interface Workout { id: Id; ownerId: Id; name: string; title: string; description?: string; muscleGroups: string[]; exercises: WorkoutExercise[]; active: boolean; createdAt?: Timestamp; updatedAt?: Timestamp }
export interface TrainingSet { id: Id; load: number; reps: number; rpe?: number; rir?: number; completed: boolean; completedAt?: Timestamp; volume: number }
export interface SessionExercise { id: Id; exerciseId: Id; name: string; order: number; target: WorkoutExercise; sets: TrainingSet[] }
export interface WorkoutSession { id: Id; ownerId: Id; workoutId: Id; workoutName: string; startedAt: Timestamp; endedAt?: Timestamp; durationSeconds?: number; exercises: SessionExercise[]; totalVolume: number; totalSets: number; status: "active" | "completed"; notes?: string }
export interface BodyWeight { id: Id; ownerId: Id; date: string; weight: number; note?: string; createdAt?: Timestamp }
export interface PhysicalAssessment { id: Id; ownerId: Id; date: string; type: "quick" | "complete"; weight?: number; height?: number; bodyFat?: number; leanMass?: number; measurements: Record<string, number | undefined>; notes?: string; photos?: Record<string, string>; createdAt?: Timestamp }
