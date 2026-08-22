import type { Timestamp } from "firebase/firestore";

export type Id = string;
export type SyncStatus = "idle" | "saving" | "saved" | "error" | "offline";
export type AssessmentType = "quick" | "complete" | "advanced";
export type BodyWeightSource = "manual" | "assessment";

export interface UserProfile {
  uid: Id;
  name: string;
  email: string;
  role: "admin" | "user";
  birthDate?: string;
  height?: number;
  sex?: string;
  goal?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SystemConfig {
  initialized: boolean;
  adminUid: string;
  updatedAt?: Timestamp;
}

export interface Exercise {
  id: Id;
  name: string;
  nameEn?: string;
  aliases?: string[];
  muscleGroup: string;
  muscleSubgroup?: string;
  equipment?: string;
  videoUrl?: string;
  sortOrder?: number;
  description?: string;
  instructions?: string;
  notes?: string;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface DefaultExercise {
  id: Id;
  name: string;
  nameEn: string;
  aliases?: string[];
  muscleGroup: string;
  muscleSubgroup?: string;
  equipment?: string;
  videoUrl: string;
  active: boolean;
  sortOrder: number;
}

export interface SeedResult {
  total: number;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  errors: number;
}

export type TrainingMethodCategory = "traditional" | "warmup" | "group" | "intensity" | "progression" | "tempo" | "failure" | "time" | "advanced";
export type TrainingMethodEngine = "normal" | "group" | "drop" | "rest-pause" | "cluster" | "progression" | "top-backoff" | "tempo" | "failure" | "amrap" | "isometric" | "partials" | "myo-reps" | "time";
export type TrainingMethodFieldType = "number" | "integer" | "percentage" | "seconds" | "reps" | "boolean" | "select" | "text" | "tempo" | "load";
export type TrainingTempo = { eccentric: number; pause: number; concentric: number; top: number };
export type TrainingMethodConfigValue = string | number | boolean | TrainingTempo | null;

export interface TrainingMethodFieldOption { label: string; value: string }
export interface TrainingMethodConfigField {
  key: string;
  label: string;
  type: TrainingMethodFieldType;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
  options?: TrainingMethodFieldOption[];
}
export interface TrainingMethodCapabilities {
  sets: boolean;
  reps: boolean;
  load: boolean;
  rest: boolean;
  rir: boolean;
  rpe: boolean;
  tempo: boolean;
  duration: boolean;
  group: boolean;
}
export interface TrainingMethodExerciseRules {
  minExercises: number;
  maxExercises: number;
  sameMuscleGroup?: boolean;
}
export interface TrainingMethod {
  id: Id;
  name: string;
  shortDescription: string;
  fullDescription: string;
  category: TrainingMethodCategory;
  engine: TrainingMethodEngine;
  iconKey: string;
  order: number;
  active: boolean;
  system: boolean;
  version: number;
  capabilities: TrainingMethodCapabilities;
  exerciseRules: TrainingMethodExerciseRules;
  configFields: TrainingMethodConfigField[];
  defaults: Record<string, TrainingMethodConfigValue>;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
export type TrainingMethodSnapshot = Omit<TrainingMethod, "createdAt" | "updatedAt">;
export interface TrainingMethodConfig {
  methodId: Id;
  values: Record<string, TrainingMethodConfigValue>;
}
export interface WorkoutExerciseGroup {
  id: Id;
  name: string;
  order: number;
  exerciseIds: Id[];
  methodConfig: TrainingMethodConfig;
  methodSnapshot: TrainingMethodSnapshot;
}

export interface WorkoutExercise {
  id: Id;
  exerciseId: Id;
  name: string;
  order: number;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  suggestedLoad?: number;
  notes?: string;
  methodConfig?: TrainingMethodConfig;
  methodSnapshot?: TrainingMethodSnapshot;
  groupId?: Id;
  groupPosition?: number;
}

export interface Workout {
  id: Id;
  ownerId: Id;
  name: string;
  title: string;
  description?: string;
  muscleGroups: string[];
  exercises: WorkoutExercise[];
  exerciseGroups?: WorkoutExerciseGroup[];
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TrainingSet {
  id: Id;
  load: number;
  reps: number;
  rpe?: number;
  rir?: number;
  completed: boolean;
  completedAt?: Timestamp;
  volume: number;
  methodId?: Id;
  methodEngine?: TrainingMethodEngine;
  methodVersion?: number;
  blockId?: Id;
  blockIndex?: number;
  stageIndex?: number;
  stageCount?: number;
  setRole?: "working" | "warmup" | "ramp" | "drop" | "pause" | "cluster" | "backoff" | "isometric" | "partial" | "timed";
  durationSeconds?: number;
  tempo?: TrainingTempo;
  restAfterSeconds?: number;
  toFailure?: boolean;
}

export interface SessionExercise {
  id: Id;
  exerciseId: Id;
  name: string;
  order: number;
  target: WorkoutExercise;
  sets: TrainingSet[];
}

export interface WorkoutSession {
  id: Id;
  ownerId: Id;
  workoutId: Id;
  workoutName: string;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  durationSeconds?: number;
  restEndsAt?: Timestamp;
  exercises: SessionExercise[];
  exerciseGroups?: WorkoutExerciseGroup[];
  totalVolume: number;
  totalSets: number;
  status: "active" | "completed" | "cancelled";
  notes?: string;
}

export interface BodyWeight {
  id: Id;
  ownerId: Id;
  date: string;
  weight: number;
  note?: string;
  source?: BodyWeightSource;
  assessmentId?: Id;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface BodyMeasurements {
  neck?: number;
  shoulders?: number;
  chest?: number;
  armRightRelaxed?: number;
  armLeftRelaxed?: number;
  armRightFlexed?: number;
  armLeftFlexed?: number;
  forearmRight?: number;
  forearmLeft?: number;
  waist?: number;
  abdomen?: number;
  hip?: number;
  thighRight?: number;
  thighLeft?: number;
  calfRight?: number;
  calfLeft?: number;
  [key: string]: number | undefined;
}

export interface Skinfolds {
  triceps?: number;
  biceps?: number;
  subscapular?: number;
  suprailiac?: number;
  abdominal?: number;
  chest?: number;
  midaxillary?: number;
  thigh?: number;
  calf?: number;
  [key: string]: number | undefined;
}

export interface PhysicalAssessment {
  id: Id;
  ownerId: Id;
  date: string;
  type: AssessmentType;
  weight?: number;
  height?: number;
  bodyFat?: number;
  fatMass?: number;
  leanMass?: number;
  measurements: BodyMeasurements;
  skinfolds?: Skinfolds;
  assessmentProtocol?: string;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type TherapyStatus = "active" | "paused" | "completed";
export type AdministrationStatus = "completed" | "skipped" | "postponed";

export type MedicationSchedule =
  | { type: "interval"; intervalDays: number }
  | { type: "weekdays"; weekdays: number[] }
  | { type: "custom"; dates: string[] };

export interface TherapyMedication {
  id: Id;
  name: string;
  formulation?: string;
  schedule: MedicationSchedule;
  reportedAmount?: number;
  reportedUnit?: string;
  notes?: string;
}

export interface Therapy {
  id: Id;
  ownerId: Id;
  name: string;
  startDate: string;
  endDate?: string;
  continuous: boolean;
  status: TherapyStatus;
  medications: TherapyMedication[];
  notes?: string;
  reminderOffsetDays?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TherapyAdministration {
  id: Id;
  ownerId: Id;
  therapyId: Id;
  medicationId: Id;
  scheduledDate: string;
  actualDate?: string;
  status: AdministrationStatus;
  reportedAmount?: number;
  reportedUnit?: string;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type SubstanceReferenceRiskTag =
  | "cardiovascular"
  | "hepatic"
  | "renal"
  | "endocrine"
  | "psychiatric"
  | "dermatologic"
  | "allergic"
  | "metabolic"
  | "hematologic"
  | "unknown-long-term";

export interface SubstanceReference {
  id: Id;
  name: string;
  canonicalName?: string;
  aliases?: string[];
  class?: string;
  description: string;
  mechanismSummary?: string;
  medicalUseSummary?: string;
  riskTags: SubstanceReferenceRiskTag[];
  sources?: string[];
  active: boolean;
  isSystem: boolean;
  sortOrder: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
