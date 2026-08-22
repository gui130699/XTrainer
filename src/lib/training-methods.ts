import { Timestamp } from "firebase/firestore";
import { DEFAULT_TRAINING_METHODS } from "@/data/default-training-methods";
import type { SessionExercise, SubstitutionType, TrainingMethod, TrainingMethodCategory, TrainingMethodConfig, TrainingMethodConfigField, TrainingMethodConfigValue, TrainingMethodEngine, TrainingMethodSnapshot, TrainingSet, TrainingTempo, Workout, WorkoutExercise, WorkoutExerciseGroup, WorkoutSession } from "@/types";

export const TRAINING_METHOD_CATEGORY_LABELS: Record<TrainingMethodCategory, string> = { traditional: "Tradicional", warmup: "Aquecimento", group: "Combinados", intensity: "Intensidade", progression: "Progressão", tempo: "Cadência", failure: "Falha", time: "Tempo", advanced: "Avançado" };
export const TRAINING_METHOD_ENGINE_LABELS: Record<TrainingMethodEngine, string> = { normal: "Séries normais", group: "Grupo", drop: "Drop-set", "rest-pause": "Rest-pause", cluster: "Cluster", progression: "Progressão", "top-backoff": "Top/back-off", tempo: "Tempo", failure: "Falha", amrap: "AMRAP", isometric: "Isometria", partials: "Parciais", "myo-reps": "Myo-reps", time: "Por tempo" };
export const TRAINING_METHOD_FIELD_TYPE_LABELS: Record<TrainingMethodConfigField["type"], string> = { number: "Número", integer: "Inteiro", percentage: "Percentual", seconds: "Segundos", reps: "Repetições", boolean: "Sim/não", select: "Seleção", text: "Texto", tempo: "Tempo", load: "Carga" };
export const TRAINING_METHOD_ENGINES = Object.keys(TRAINING_METHOD_ENGINE_LABELS) as TrainingMethodEngine[];
export const TRAINING_METHOD_CATEGORIES = Object.keys(TRAINING_METHOD_CATEGORY_LABELS) as TrainingMethodCategory[];
export const TRAINING_METHOD_FIELD_TYPES = Object.keys(TRAINING_METHOD_FIELD_TYPE_LABELS) as TrainingMethodConfigField["type"][];

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const finite = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const integer = (value: unknown, fallback = 0) => Math.max(0, Math.round(finite(value, fallback)));
const tempoValue = (value: TrainingMethodConfigValue | undefined): TrainingTempo | undefined => value && typeof value === "object" && "eccentric" in value ? value as TrainingTempo : undefined;

export function normalTrainingMethod(): TrainingMethod { return clone(DEFAULT_TRAINING_METHODS[0]); }
export function snapshotMethod(method?: TrainingMethod | TrainingMethodSnapshot): TrainingMethodSnapshot {
  const value = method ?? normalTrainingMethod();
  const snapshot = clone(value) as TrainingMethod;
  delete snapshot.createdAt;
  delete snapshot.updatedAt;
  return clone(snapshot);
}
export function methodValues(method: TrainingMethod | TrainingMethodSnapshot, config?: TrainingMethodConfig) {
  return { ...clone(method.defaults), ...(config?.methodId === method.id ? clone(config.values) : {}) };
}
export function createMethodConfig(method: TrainingMethod | TrainingMethodSnapshot, values: Record<string, TrainingMethodConfigValue> = {}): TrainingMethodConfig {
  return { methodId: method.id, values: methodValues(method, { methodId: method.id, values }) };
}

export function sanitizeConfigValue(field: TrainingMethodConfigField, value: unknown): TrainingMethodConfigValue {
  if (field.type === "boolean") return value === true || value === "true";
  if (field.type === "text" || field.type === "select") return String(value ?? "");
  if (field.type === "tempo") {
    const data = value && typeof value === "object" ? value as Partial<TrainingTempo> : {};
    return { eccentric: integer(data.eccentric), pause: integer(data.pause), concentric: integer(data.concentric), top: integer(data.top) };
  }
  let result = finite(typeof value === "string" ? Number(value) : value);
  if (field.type === "integer" || field.type === "seconds" || field.type === "reps") result = Math.round(result);
  if (field.min !== undefined) result = Math.max(field.min, result);
  if (field.max !== undefined) result = Math.min(field.max, result);
  return result;
}

export function validateTrainingMethod(method: TrainingMethod) {
  const errors: string[] = [];
  if (!method.id.trim() || !/^[a-z0-9-]+$/.test(method.id)) errors.push("O ID deve usar apenas letras minúsculas, números e hífen.");
  if (!method.name.trim()) errors.push("Informe o nome.");
  if (!method.shortDescription.trim()) errors.push("Informe a descrição curta.");
  if (!TRAINING_METHOD_ENGINES.includes(method.engine)) errors.push("Motor inválido.");
  if (method.exerciseRules.minExercises < 1 || method.exerciseRules.maxExercises < method.exerciseRules.minExercises) errors.push("Limites de exercícios inválidos.");
  const keys = new Set<string>();
  for (const item of method.configFields) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(item.key)) errors.push(`Chave inválida: ${item.key || "vazia"}.`);
    if (keys.has(item.key)) errors.push(`Chave duplicada: ${item.key}.`);
    keys.add(item.key);
    if (!TRAINING_METHOD_FIELD_TYPES.includes(item.type)) errors.push(`Tipo de campo inválido em ${item.key}.`);
    if (item.type === "select" && !item.options?.length) errors.push(`O campo ${item.label} precisa de opções.`);
  }
  return errors;
}

export function normalizeWorkoutMethod(exercise: WorkoutExercise) {
  const methodSnapshot = snapshotMethod(exercise.methodSnapshot);
  const methodConfig = exercise.methodConfig?.methodId === methodSnapshot.id ? exercise.methodConfig : createMethodConfig(methodSnapshot);
  return { ...exercise, methodSnapshot, methodConfig };
}

function groupRest(exercise: WorkoutExercise, workout: Workout) {
  if (!exercise.groupId) return exercise.restSeconds;
  const group = workout.exerciseGroups?.find((item) => item.id === exercise.groupId);
  if (!group) return exercise.restSeconds;
  const values = methodValues(group.methodSnapshot, group.methodConfig);
  const position = exercise.groupPosition ?? group.exerciseIds.indexOf(exercise.id);
  return position >= group.exerciseIds.length - 1 ? finite(values.restAfterRound, exercise.restSeconds) : finite(values.restBetweenExercises, 0);
}

export function createTrainingSets(exerciseInput: WorkoutExercise, workout: Workout, previousLoads: number[] = []): TrainingSet[] {
  const exercise = normalizeWorkoutMethod(exerciseInput);
  const method = exercise.methodSnapshot!;
  const values = methodValues(method, exercise.methodConfig);
  const sets = Math.max(1, integer(exercise.sets, 3));
  const reps = Math.max(0, integer(exercise.repsMin, 8));
  const load = Math.max(0, finite(exercise.suggestedLoad, 0));
  // Cada posição de série (block) mantém a última carga realmente usada nela, em vez de
  // sempre reiniciar da carga sugerida do treino. Sem histórico para aquela posição, cai
  // para a carga sugerida.
  const loadForBlock = (block: number) => { const remembered = previousLoads[block]; return remembered !== undefined && remembered >= 0 ? remembered : load; };
  const finalRest = groupRest(exercise, workout);
  const baseRole = values.setRole === "warmup" || values.setRole === "ramp" ? values.setRole : "working";
  const result: TrainingSet[] = [];
  const push = (blockIndex: number, stageIndex: number, stageCount: number, overrides: Partial<TrainingSet> = {}) => result.push({
    id: `${exercise.id}-${blockIndex}-${stageIndex}`,
    load: loadForBlock(blockIndex), reps, completed: false, volume: 0,
    methodId: method.id, methodEngine: method.engine, methodVersion: method.version,
    blockId: `${exercise.id}-block-${blockIndex}`, blockIndex, stageIndex, stageCount,
    setRole: baseRole, restAfterSeconds: stageIndex === stageCount - 1 ? finalRest : 0,
    ...overrides,
  });

  if (method.engine === "drop") {
    const drops = integer(values.drops, 2);
    for (let block = 0; block < sets; block += 1) for (let stage = 0; stage <= drops; stage += 1) push(block, stage, drops + 1, { load: Math.max(0, loadForBlock(block) * Math.pow(1 - finite(values.reductionPercent, 20) / 100, stage)), setRole: stage ? "drop" : baseRole, restAfterSeconds: stage === drops ? finalRest : finite(values.restBetweenDrops, 0), toFailure: stage === drops && values.lastDropToFailure === true });
  } else if (method.engine === "rest-pause") {
    const pauses = integer(values.pauses, 2);
    for (let block = 0; block < sets; block += 1) for (let stage = 0; stage <= pauses; stage += 1) push(block, stage, pauses + 1, { reps: stage ? integer(values.extraReps, 3) : reps, setRole: stage ? "pause" : baseRole, restAfterSeconds: stage === pauses ? finalRest : finite(values.pauseSeconds, 15) });
  } else if (method.engine === "cluster") {
    const clusters = Math.max(2, integer(values.clusters, 4));
    for (let block = 0; block < sets; block += 1) for (let stage = 0; stage < clusters; stage += 1) push(block, stage, clusters, { reps: integer(values.repsPerCluster, 3), setRole: "cluster", restAfterSeconds: stage === clusters - 1 ? finalRest : finite(values.clusterRestSeconds, 20) });
  } else if (method.engine === "progression") {
    for (let block = 0; block < sets; block += 1) push(block, 0, 1, { load: Math.max(0, load * (1 + finite(values.loadStepPercent) * block / 100)), reps: Math.max(0, Math.round(reps + finite(values.repStep) * block)), setRole: baseRole });
  } else if (method.engine === "top-backoff") {
    const top = integer(values.topSets, method.id === "backoff" ? 0 : 1);
    const backoff = integer(values.backoffSets, method.id === "top-set" ? 0 : 3);
    const count = Math.max(1, top + backoff);
    for (let index = 0; index < count; index += 1) push(index, 0, 1, { load: index < top ? load : load * (1 - finite(values.backoffReductionPercent, 15) / 100), reps: integer(index < top ? values.topRepsMin : values.backoffRepsMin, reps), rir: integer(index < top ? values.topRir : values.backoffRir), setRole: index < top ? "working" : "backoff" });
  } else if (method.engine === "myo-reps") {
    const miniSets = integer(values.miniSets, 4);
    push(0, 0, miniSets + 1, { reps: integer(values.activationReps, 15), restAfterSeconds: finite(values.pauseSeconds, 15) });
    for (let stage = 1; stage <= miniSets; stage += 1) push(0, stage, miniSets + 1, { reps: integer(values.miniReps, 4), setRole: "pause", restAfterSeconds: stage === miniSets ? finalRest : finite(values.pauseSeconds, 15) });
  } else if (method.engine === "partials") {
    for (let block = 0; block < sets; block += 1) { push(block, 0, 2); push(block, 1, 2, { reps: integer(values.partialReps, 5), setRole: "partial", restAfterSeconds: finalRest }); }
  } else {
    for (let block = 0; block < sets; block += 1) push(block, 0, 1, {
      toFailure: method.engine === "failure" || method.engine === "amrap" || values.toFailure === true,
      durationSeconds: method.engine === "isometric" || method.engine === "time" ? integer(values.durationSeconds, 30) : undefined,
      setRole: method.engine === "isometric" ? "isometric" : method.engine === "time" ? "timed" : baseRole,
      tempo: method.engine === "tempo" ? tempoValue(values.tempo) : undefined,
    });
  }
  return clone(result);
}

export function trainingStageLabel(set: TrainingSet) {
  if (set.setRole === "drop") return `Drop ${set.stageIndex}`;
  if (set.setRole === "pause") return set.methodEngine === "myo-reps" ? `Myo ${set.stageIndex}` : `Rest-pause ${set.stageIndex}`;
  if (set.setRole === "cluster") return `Cluster ${(set.stageIndex ?? 0) + 1}`;
  if (set.setRole === "backoff") return "Back-off";
  if (set.setRole === "warmup") return "Aquecimento";
  if (set.setRole === "ramp") return "Aproximação";
  if (set.setRole === "isometric") return "Isometria";
  if (set.setRole === "partial") return "Parciais";
  if (set.setRole === "timed") return "Por tempo";
  if (set.methodEngine === "amrap") return "AMRAP";
  if (set.methodEngine === "failure") return "Até a falha";
  return `Série ${(set.blockIndex ?? 0) + 1}`;
}

export function isWorkingSet(set: TrainingSet) { return set.setRole !== "warmup" && set.setRole !== "ramp"; }

// Troca de exercício durante a sessão. Séries já concluídas são congeladas com a identidade que
// realmente executaram (actualExerciseId/actualExerciseName) antes do SessionExercise apontar
// para o substituto; séries ainda pendentes não recebem esse carimbo e passam a representar o
// novo exercício naturalmente, herdando a identidade atual do SessionExercise. originalExerciseId
// só é gravado na primeira troca, preservando o exercício planejado original mesmo após trocas
// sucessivas.
export function applyExerciseSwap(exercise: SessionExercise, replacement: { id: string; name: string }, scope: SubstitutionType): SessionExercise {
  return {
    ...exercise,
    originalExerciseId: exercise.originalExerciseId ?? exercise.exerciseId,
    originalExerciseName: exercise.originalExerciseName ?? exercise.name,
    exerciseId: replacement.id,
    name: replacement.name,
    substitutionType: scope,
    substitutedAt: Timestamp.now(),
    sets: exercise.sets.map((set) => set.completed ? { ...set, actualExerciseId: set.actualExerciseId ?? exercise.exerciseId, actualExerciseName: set.actualExerciseName ?? exercise.name } : set),
  };
}

// Pular hoje: séries já concluídas nunca são tocadas. Só as pendentes viram "skipped" — nunca
// entram em volume, séries efetivas ou recordes (aggregateExerciseSession já as ignora porque
// nunca ficam completed).
export function applyExerciseSkip(exercise: SessionExercise, reasonCode?: string, reasonText?: string): SessionExercise {
  return {
    ...exercise,
    skipInfo: { skipped: true, reasonCode, reasonText, skippedAt: Timestamp.now() },
    sets: exercise.sets.map((set) => set.completed ? set : { ...set, skipped: true }),
  };
}

export function undoExerciseSkip(exercise: SessionExercise): SessionExercise {
  return { ...exercise, skipInfo: undefined, sets: exercise.sets.map((set) => ({ ...set, skipped: undefined })) };
}

// Determina o descanso correto ao concluir uma série de um exercício agrupado (bi-set, tri-set
// etc.), considerando membros pulados. O valor pré-calculado em cada série (restAfterSeconds)
// assume que todo mundo participa; se um membro for pulado, a posição "última do grupo" pode
// mudar. Retorna null quando o valor pré-calculado da série já está correto (uso normal, sem
// pulos, ou rodada ainda não terminou) e um número quando é preciso sobrescrever porque a rodada
// só terminou agora, considerando os pulos.
export function groupRoundRestOverride(session: WorkoutSession, exercise: SessionExercise, round: number): number | null {
  const groupId = exercise.target.groupId;
  if (!groupId) return null;
  const group = session.exerciseGroups?.find((item) => item.id === groupId);
  if (!group) return null;
  const members = group.exerciseIds.map((id) => session.exercises.find((item) => item.id === id)).filter((item): item is SessionExercise => Boolean(item));
  const executable = members.filter((member) => !member.skipInfo?.skipped);
  if (!executable.length) return 0;
  const roundDone = executable.every((member) => { const set = member.sets[round]; return !set || set.completed || set.skipped; });
  if (!roundDone) return null;
  const values = methodValues(group.methodSnapshot, group.methodConfig);
  return typeof values.restAfterRound === "number" ? Math.max(0, values.restAfterRound) : null;
}

// Um exercício de grupo é considerado concluído quando todos os membros executáveis (não
// pulados) terminaram todas as suas séries planejadas, ou quando o grupo inteiro foi pulado.
export function isGroupSessionComplete(session: WorkoutSession, group: WorkoutExerciseGroup): boolean {
  const members = group.exerciseIds.map((id) => session.exercises.find((item) => item.id === id)).filter((item): item is SessionExercise => Boolean(item));
  const executable = members.filter((member) => !member.skipInfo?.skipped);
  if (!executable.length) return true;
  return executable.every((member) => member.sets.length > 0 && member.sets.every((set) => set.completed || set.skipped));
}
