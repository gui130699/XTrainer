import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { DEFAULT_EXERCISES } from "@/data/default-exercises";
import { normalizeSearchText } from "@/lib/utils";
import { createTrainingSets, normalizeWorkoutMethod } from "@/lib/training-methods";
import {
  normalizeAssessmentDocument,
  normalizeBodyWeightDocument,
  normalizeExerciseDocument,
  normalizeWorkoutDocument,
  normalizeWorkoutSessionDocument,
} from "@/lib/compatibility";
import type {
  AssessmentPhotoView,
  BodyWeight,
  Exercise,
  PhysicalAssessment,
  SeedResult,
  Workout,
  WorkoutSession,
} from "@/types";

const withoutUndefined = <T extends object>(data: T) => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
const withoutUndefinedDeep = <T>(data: T): T => {
  if (Array.isArray(data)) return data.map(withoutUndefinedDeep) as T;
  if (data && typeof data === "object" && Object.getPrototypeOf(data) === Object.prototype) return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined).map(([key, value]) => [key, withoutUndefinedDeep(value)])) as T;
  return data;
};
const missingIndex = (reason: unknown) => {
  if (!reason || typeof reason !== "object" || !("code" in reason)) return false;
  return String((reason as { code?: unknown }).code).endsWith("failed-precondition");
};
const sessionStartedAt = (item: WorkoutSession) => item.startedAt?.toMillis() ?? 0;
const listOwnerDocuments = (collectionName: string, uid: string) => getDocs(query(collection(db, collectionName), where("ownerId", "==", uid)));
function validateDefaultExercises() {
  if (DEFAULT_EXERCISES.length !== 202) throw Error("O dataset padrão deve possuir exatamente 202 exercícios.");
  const ids = new Set<string>();
  const orders = new Set<number>();
  const names = new Set<string>();
  for (const item of DEFAULT_EXERCISES) {
    const video = new URL(item.videoUrl);
    const videoSearch = normalizeSearchText(video.searchParams.get("search_query") ?? "");
    if (!item.id || !item.name || !item.muscleGroup || video.hostname !== "www.youtube.com" || video.pathname !== "/results" || !videoSearch.includes("execucao correta musculacao em portugues")) throw Error(`Exercício inválido: ${item.name || item.id}`);
    if (ids.has(item.id) || orders.has(item.sortOrder) || names.has(normalizeSearchText(item.name))) throw Error(`Duplicidade encontrada: ${item.name}`);
    ids.add(item.id);
    orders.add(item.sortOrder);
    names.add(normalizeSearchText(item.name));
  }
  for (let index = 1; index <= 202; index += 1) if (!orders.has(index)) throw Error(`Ordem padrão ausente: ${index}`);
}

export const exercises = {
  list: async () => (await getDocs(query(collection(db, "exercises"), orderBy("name")))).docs.map((item) => normalizeExerciseDocument(item.id, item.data())),
  save: async (data: Omit<Exercise, "id" | "createdAt" | "updatedAt">, id?: string) => {
    const payload = withoutUndefined({
      name: data.name,
      nameEn: data.nameEn,
      aliases: data.aliases,
      muscleGroup: data.muscleGroup,
      muscleSubgroup: data.muscleSubgroup,
      equipment: data.equipment,
      videoUrl: data.videoUrl,
      sortOrder: data.sortOrder,
      description: data.description,
      instructions: data.instructions,
      notes: data.notes,
      active: data.active,
      updatedAt: serverTimestamp(),
    });
    if (id) return updateDoc(doc(db, "exercises", id), payload);
    return addDoc(collection(db, "exercises"), { ...payload, createdAt: serverTimestamp() });
  },
  remove: (id: string) => deleteDoc(doc(db, "exercises", id)),
  seedDefaultLibrary: async (): Promise<SeedResult> => {
    validateDefaultExercises();
    const existing = await getDocs(collection(db, "exercises"));
    const existingById = new Map(existing.docs.map((item) => [item.id, item.data()]));
    const canonicalIds = new Set(DEFAULT_EXERCISES.map((item) => item.id));
    const stale = existing.docs.filter((item) => !canonicalIds.has(item.id));
    const result: SeedResult = { total: DEFAULT_EXERCISES.length, created: 0, updated: 0, deleted: stale.length, skipped: 0, errors: 0 };
    for (let start = 0; start < DEFAULT_EXERCISES.length; start += 400) {
      const batch = writeBatch(db);
      for (const item of DEFAULT_EXERCISES.slice(start, start + 400)) {
        const existingData = existingById.get(item.id);
        const { id, ...canonical } = item;
        batch.set(doc(db, "exercises", id), withoutUndefined({
          ...canonical,
          createdAt: existingData?.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        }));
        if (existingData) result.updated += 1;
        else result.created += 1;
      }
      await batch.commit();
    }
    for (let start = 0; start < stale.length; start += 400) {
      const batch = writeBatch(db);
      for (const item of stale.slice(start, start + 400)) batch.delete(item.ref);
      await batch.commit();
    }
    return result;
  },
};

type WorkoutInput = Omit<Workout, "id" | "createdAt" | "updatedAt">;
const workoutPayload = (data: WorkoutInput) => withoutUndefined({
  ownerId: data.ownerId,
  name: data.name,
  title: data.title,
  description: data.description,
  muscleGroups: data.muscleGroups,
  exercises: withoutUndefinedDeep(data.exercises),
  exerciseGroups: data.exerciseGroups ? withoutUndefinedDeep(data.exerciseGroups) : undefined,
  active: data.active,
});

export const workouts = {
  list: async (uid: string) => (await getDocs(query(collection(db, "workouts"), where("ownerId", "==", uid)))).docs.map((item) => normalizeWorkoutDocument(item.id, item.data())).sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)),
  save: async (data: WorkoutInput, id?: string) => {
    const payload = workoutPayload(data);
    if (id) return updateDoc(doc(db, "workouts", id), { ...payload, updatedAt: serverTimestamp() });
    return addDoc(collection(db, "workouts"), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  },
  remove: (id: string) => deleteDoc(doc(db, "workouts", id)),
  duplicate: (workout: Workout) => addDoc(collection(db, "workouts"), {
    ...workoutPayload({
      ownerId: workout.ownerId,
      name: `${workout.name} - Cópia`,
      title: `${workout.title} - Cópia`,
      description: workout.description,
      muscleGroups: workout.muscleGroups,
      exercises: workout.exercises,
      exerciseGroups: workout.exerciseGroups,
      active: workout.active,
    }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }),
};

type BodyWeightInput = Omit<BodyWeight, "id" | "createdAt" | "updatedAt">;
const weightPayload = (data: BodyWeightInput) => withoutUndefined({
  ownerId: data.ownerId,
  date: data.date,
  weight: data.weight,
  note: data.note,
  source: data.source,
  assessmentId: data.assessmentId,
});

export const weights = {
  list: async (uid: string) => {
    try {
      return (await getDocs(query(collection(db, "bodyWeights"), where("ownerId", "==", uid), orderBy("date", "asc")))).docs.map((item) => normalizeBodyWeightDocument(item.id, item.data()));
    } catch (reason) {
      if (!missingIndex(reason)) throw reason;
      return (await listOwnerDocuments("bodyWeights", uid)).docs.map((item) => normalizeBodyWeightDocument(item.id, item.data())).sort((a, b) => a.date.localeCompare(b.date));
    }
  },
  save: (data: BodyWeightInput) => addDoc(collection(db, "bodyWeights"), { ...weightPayload(data), createdAt: serverTimestamp() }),
  update: (id: string, data: Pick<BodyWeight, "date" | "weight" | "note">) => updateDoc(doc(db, "bodyWeights", id), { ...withoutUndefined(data), updatedAt: serverTimestamp() }),
  remove: (id: string) => deleteDoc(doc(db, "bodyWeights", id)),
};

type AssessmentInput = Omit<PhysicalAssessment, "id" | "createdAt" | "updatedAt">;
const assessmentPayload = (data: AssessmentInput) => withoutUndefined({
  ownerId: data.ownerId,
  date: data.date,
  type: data.type,
  weight: data.weight,
  height: data.height,
  bodyFat: data.bodyFat,
  fatMass: data.fatMass,
  leanMass: data.leanMass,
  measurements: withoutUndefined(data.measurements),
  skinfolds: data.skinfolds ? withoutUndefined(data.skinfolds) : undefined,
  assessmentProtocol: data.assessmentProtocol,
  notes: data.notes,
  photos: data.photos,
});

export const assessments = {
  list: async (uid: string) => {
    try {
      return (await getDocs(query(collection(db, "physicalAssessments"), where("ownerId", "==", uid), orderBy("date", "desc")))).docs.map((item) => normalizeAssessmentDocument(item.id, item.data()));
    } catch (reason) {
      if (!missingIndex(reason)) throw reason;
      return (await listOwnerDocuments("physicalAssessments", uid)).docs.map((item) => normalizeAssessmentDocument(item.id, item.data())).sort((a, b) => b.date.localeCompare(a.date));
    }
  },
  save: async (data: AssessmentInput, id?: string) => {
    const payload = assessmentPayload(data);
    if (id) {
      await updateDoc(doc(db, "physicalAssessments", id), { ...payload, updatedAt: serverTimestamp() });
      return id;
    }
    const created = await addDoc(collection(db, "physicalAssessments"), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return created.id;
  },
  remove: (id: string) => deleteDoc(doc(db, "physicalAssessments", id)),
  uploadPhoto: async (uid: string, assessmentId: string, view: AssessmentPhotoView, file: File) => {
    if (!file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
    if (file.size >= 8 * 1024 * 1024) throw new Error("A imagem deve ter menos de 8 MB.");
    const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
    const target = ref(storage, `users/${uid}/assessments/${assessmentId}/${view}-${Date.now()}.${extension}`);
    await uploadBytes(target, file, { contentType: file.type });
    return getDownloadURL(target);
  },
};

export interface SessionPage {
  items: WorkoutSession[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

const activeSessionId = (uid: string) => `active-${uid}`;
const sessionDocumentPayload = (session: Omit<WorkoutSession, "id"> | WorkoutSession) => withoutUndefined({
  ownerId: session.ownerId,
  workoutId: session.workoutId,
  workoutName: session.workoutName,
  startedAt: session.startedAt,
  endedAt: session.endedAt,
  durationSeconds: session.durationSeconds,
  restEndsAt: session.restEndsAt,
  exercises: withoutUndefinedDeep(session.exercises),
  exerciseGroups: session.exerciseGroups ? withoutUndefinedDeep(session.exerciseGroups) : undefined,
  totalVolume: session.totalVolume,
  totalSets: session.totalSets,
  status: session.status,
  notes: session.notes,
});

const createSessionFromWorkout = (uid: string, workout: Workout): Omit<WorkoutSession, "id"> => ({
  ownerId: uid,
  workoutId: workout.id,
  workoutName: workout.name,
  startedAt: Timestamp.now(),
  status: "active",
  totalVolume: 0,
  totalSets: 0,
  exerciseGroups: workout.exerciseGroups,
  exercises: workout.exercises.map((exercise) => ({
    id: exercise.id,
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    order: exercise.order,
    target: normalizeWorkoutMethod(exercise),
    sets: createTrainingSets(exercise, workout),
  })),
});

async function migrateLegacyActive(uid: string, legacy: QueryDocumentSnapshot<DocumentData>[]) {
  const targetRef = doc(db, "workoutSessions", activeSessionId(uid));
  await runTransaction(db, async (transaction) => {
    const target = await transaction.get(targetRef);
    const legacySnapshots = [];
    for (const item of legacy) legacySnapshots.push(await transaction.get(item.ref));
    let migratedPath = "";
    if (!target.exists()) {
      const first = legacySnapshots.find((item) => item.exists());
      if (first) {
        migratedPath = first.ref.path;
        transaction.set(targetRef, first.data());
        transaction.delete(first.ref);
      }
    }
    for (const item of legacySnapshots) {
      if (item.exists() && item.ref.path !== migratedPath) transaction.update(item.ref, { status: "cancelled", endedAt: serverTimestamp() });
    }
  });
  const migrated = await getDoc(targetRef);
  return migrated.exists() ? normalizeWorkoutSessionDocument(migrated.id, migrated.data()) : null;
}

export const sessions = {
  list: async (uid: string) => {
    try {
      return (await getDocs(query(collection(db, "workoutSessions"), where("ownerId", "==", uid), orderBy("startedAt", "desc"), limit(30)))).docs.map((item) => normalizeWorkoutSessionDocument(item.id, item.data()));
    } catch (reason) {
      if (!missingIndex(reason)) throw reason;
      return (await listOwnerDocuments("workoutSessions", uid)).docs.map((item) => normalizeWorkoutSessionDocument(item.id, item.data())).sort((a, b) => sessionStartedAt(b) - sessionStartedAt(a)).slice(0, 30);
    }
  },
  listCompletedPage: async (uid: string, pageSize = 20, cursor?: QueryDocumentSnapshot<DocumentData> | null): Promise<SessionPage> => {
    const documents = (await listOwnerDocuments("workoutSessions", uid)).docs
      .filter((item) => item.data().status === "completed")
      .sort((a, b) => sessionStartedAt(normalizeWorkoutSessionDocument(b.id, b.data())) - sessionStartedAt(normalizeWorkoutSessionDocument(a.id, a.data())));
    const start = cursor ? Math.max(0, documents.findIndex((item) => item.id === cursor.id) + 1) : 0;
    const page = documents.slice(start, start + pageSize);
    return {
      items: page.map((item) => normalizeWorkoutSessionDocument(item.id, item.data())),
      cursor: page.at(-1) ?? null,
      hasMore: start + page.length < documents.length,
    };
  },
  listCompletedBetween: async (uid: string, start: Date, end: Date) => {
    const startMillis = start.getTime();
    const endMillis = end.getTime();
    return (await listOwnerDocuments("workoutSessions", uid)).docs
      .map((item) => normalizeWorkoutSessionDocument(item.id, item.data()))
      .filter((item) => item.status === "completed" && sessionStartedAt(item) >= startMillis && sessionStartedAt(item) < endMillis)
      .sort((a, b) => sessionStartedAt(b) - sessionStartedAt(a));
  },
  listAllCompleted: async (uid: string, pageSize = 100) => {
    const items: WorkoutSession[] = [];
    let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
    do {
      const page = await sessions.listCompletedPage(uid, pageSize, cursor);
      items.push(...page.items);
      cursor = page.hasMore ? page.cursor : null;
    } while (cursor);
    return items;
  },
  get: async (id: string) => {
    const snapshot = await getDoc(doc(db, "workoutSessions", id));
    return snapshot.exists() ? normalizeWorkoutSessionDocument(snapshot.id, snapshot.data()) : null;
  },
  getActive: async (uid: string) => {
    const fixed = await getDoc(doc(db, "workoutSessions", activeSessionId(uid)));
    if (fixed.exists() && fixed.data().status === "active") return normalizeWorkoutSessionDocument(fixed.id, fixed.data());
    let legacyDocuments: QueryDocumentSnapshot<DocumentData>[];
    try {
      legacyDocuments = (await getDocs(query(collection(db, "workoutSessions"), where("ownerId", "==", uid), where("status", "==", "active"), limit(10)))).docs;
    } catch (reason) {
      if (!missingIndex(reason)) throw reason;
      const owned = await listOwnerDocuments("workoutSessions", uid);
      legacyDocuments = owned.docs.filter((item) => item.data().status === "active").slice(0, 10);
    }
    return legacyDocuments.length ? migrateLegacyActive(uid, legacyDocuments) : null;
  },
  start: async (uid: string, workout: Workout) => {
    const id = activeSessionId(uid);
    const reference = doc(db, "workoutSessions", id);
    const local = createSessionFromWorkout(uid, workout);
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(reference);
      if (existing.exists()) throw new Error("Você já possui um treino em andamento.");
      transaction.set(reference, { ...sessionDocumentPayload(local), startedAt: serverTimestamp() });
    });
    return { id, ...local } as WorkoutSession;
  },
  save: (id: string, data: Pick<WorkoutSession, "exercises" | "totalVolume" | "totalSets"> & Partial<Pick<WorkoutSession, "restEndsAt" | "notes">>) => updateDoc(doc(db, "workoutSessions", id), {
    ...withoutUndefined(data),
    ...(Object.prototype.hasOwnProperty.call(data, "restEndsAt") && data.restEndsAt === undefined ? { restEndsAt: deleteField() } : {}),
  }),
  complete: async (session: WorkoutSession, durationSeconds: number) => {
    const activeRef = doc(db, "workoutSessions", session.id);
    const historyRef = doc(collection(db, "workoutSessions"));
    await runTransaction(db, async (transaction) => {
      const stored = await transaction.get(activeRef);
      if (!stored.exists() || stored.data().ownerId !== session.ownerId) throw new Error("A sessão ativa não foi encontrada.");
      transaction.set(historyRef, {
        ...sessionDocumentPayload({ ...session, status: "completed", durationSeconds, restEndsAt: undefined }),
        startedAt: stored.data().startedAt ?? session.startedAt ?? serverTimestamp(),
        endedAt: serverTimestamp(),
      });
      transaction.delete(activeRef);
    });
    return { ...session, id: historyRef.id, status: "completed" as const, durationSeconds, endedAt: Timestamp.now(), restEndsAt: undefined };
  },
  cancel: async (session: WorkoutSession) => {
    const activeRef = doc(db, "workoutSessions", session.id);
    const historyRef = doc(collection(db, "workoutSessions"));
    await runTransaction(db, async (transaction) => {
      const stored = await transaction.get(activeRef);
      if (!stored.exists() || stored.data().ownerId !== session.ownerId) throw new Error("A sessão ativa não foi encontrada.");
      transaction.set(historyRef, {
        ...sessionDocumentPayload({ ...session, status: "cancelled", restEndsAt: undefined }),
        startedAt: stored.data().startedAt ?? session.startedAt ?? serverTimestamp(),
        endedAt: serverTimestamp(),
      });
      transaction.delete(activeRef);
    });
    return historyRef.id;
  },
};
