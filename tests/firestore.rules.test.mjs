import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, runTransaction, setDoc, Timestamp, updateDoc } from "firebase/firestore";

let environment;
let anonymous;
let admin;
let userA;
let userB;

const profile = (uid, role = "user") => ({ uid, name: uid, email: `${uid}@test.dev`, role });
const workout = (ownerId) => ({ ownerId, name: "Treino A", title: "Treino A", muscleGroups: ["Peito"], exercises: [], active: true });
const session = (ownerId, status = "active") => ({ ownerId, workoutId: "work-a", workoutName: "Treino A", exercises: [], totalVolume: 0, totalSets: 0, status });
const substitutionPreference = (ownerId) => ({ ownerId, exerciseId: "supino", alternativeExerciseIds: ["supino-maquina"] });

before(async () => {
  environment = await initializeTestEnvironment({ projectId: "xtrainer-45f8d", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, "system", "config"), { initialized: true, adminUid: "admin" });
    await setDoc(doc(database, "users", "admin"), profile("admin", "admin"));
    await setDoc(doc(database, "users", "user-a"), profile("user-a"));
    await setDoc(doc(database, "users", "user-b"), profile("user-b"));
    await setDoc(doc(database, "exercises", "supino"), { name: "Supino", muscleGroup: "Peito", active: true });
    await setDoc(doc(database, "trainingMethods", "series-normais"), { name: "Séries normais", active: true, engine: "normal" });
    await setDoc(doc(database, "workouts", "work-a"), workout("user-a"));
    await setDoc(doc(database, "workoutSessions", "history-a"), session("user-a", "completed"));
    await setDoc(doc(database, "bodyWeights", "weight-a"), { ownerId: "user-a", date: "2026-08-17", weight: 80 });
    await setDoc(doc(database, "physicalAssessments", "assessment-a"), { ownerId: "user-a", date: "2026-08-17", type: "quick", measurements: {} });
    await setDoc(doc(database, "exerciseSubstitutionPreferences", "pref-a"), substitutionPreference("user-a"));
  });
  anonymous = environment.unauthenticatedContext().firestore();
  admin = environment.authenticatedContext("admin").firestore();
  userA = environment.authenticatedContext("user-a").firestore();
  userB = environment.authenticatedContext("user-b").firestore();
});

after(async () => environment?.cleanup());

test("configuração pode ser lida, mas nunca inicializada pelo cliente", async () => {
  await assertSucceeds(getDoc(doc(anonymous, "system", "config")));
  await assertFails(setDoc(doc(anonymous, "system", "other"), { adminUid: "attacker", initialized: true }));
  await assertFails(setDoc(doc(userA, "system", "config"), { adminUid: "user-a", initialized: true }));
});

test("cadastro comum não consegue promover a si mesmo a administrador", async () => {
  const regular = environment.authenticatedContext("new-user").firestore();
  await assertSucceeds(setDoc(doc(regular, "users", "new-user"), profile("new-user")));
  const attacker = environment.authenticatedContext("attacker").firestore();
  await assertFails(setDoc(doc(attacker, "users", "attacker"), profile("attacker", "admin")));
});

test("usuário vê somente o próprio perfil e dados corporais", async () => {
  await assertSucceeds(getDoc(doc(userA, "users", "user-a")));
  await assertFails(getDoc(doc(userA, "users", "user-b")));
  for (const path of ["workouts/work-a", "workoutSessions/history-a", "bodyWeights/weight-a", "physicalAssessments/assessment-a", "exerciseSubstitutionPreferences/pref-a"]) {
    await assertSucceeds(getDoc(doc(userA, path)));
    await assertFails(getDoc(doc(userB, path)));
  }
});

test("usuário atualiza os próprios dados pessoais sem alterar identidade ou papel", async () => {
  const reference = doc(userA, "users", "user-a");
  await assertSucceeds(updateDoc(reference, {
    name: "Usuário atualizado",
    height: 171,
    goal: "Hipertrofia",
    birthDate: "1999-05-13",
    sex: "male",
    updatedAt: Timestamp.now(),
  }));
  await assertSucceeds(updateDoc(reference, { birthDate: deleteField(), sex: deleteField(), updatedAt: Timestamp.now() }));
  await assertFails(updateDoc(reference, { uid: "user-b" }));
  await assertFails(updateDoc(reference, { role: "admin" }));
  await assertFails(updateDoc(reference, { createdAt: Timestamp.now() }));
});

test("Authentication existe mas users/{uid} não existe: dono cria o próprio perfil mínimo", async () => {
  const orphan = environment.authenticatedContext("orphan-user").firestore();
  const reference = doc(orphan, "users", "orphan-user");
  await assertSucceeds(getDoc(reference));
  await assertSucceeds(setDoc(reference, { uid: "orphan-user", name: "Órfão", email: "orphan@test.dev", role: "user" }));
  await assertSucceeds(updateDoc(reference, { name: "Órfão Atualizado", updatedAt: Timestamp.now() }));
});

test("perfil órfão: não pode criar para outro UID nem se autopromover a admin", async () => {
  const orphan = environment.authenticatedContext("orphan-b").firestore();
  await assertFails(setDoc(doc(orphan, "users", "someone-else"), { uid: "someone-else", name: "Invasor", email: "x@test.dev", role: "user" }));
  await assertFails(setDoc(doc(orphan, "users", "orphan-b"), { uid: "orphan-b", name: "Órfão", email: "orphan-b@test.dev", role: "admin" }));
});

test("autoridade administrativa deriva de system/config.adminUid, não do campo role do próprio perfil", async () => {
  await assertSucceeds(getDoc(doc(admin, "users", "user-a")));
});

test("usuário lê exercícios, mas somente admin altera a biblioteca", async () => {
  await assertSucceeds(getDoc(doc(userA, "exercises", "supino")));
  await assertFails(updateDoc(doc(userA, "exercises", "supino"), { active: false }));
  await assertSucceeds(updateDoc(doc(admin, "exercises", "supino"), { active: false }));
});

test("catálogo de grupos musculares é global para autenticados e gravável apenas pelo admin", async () => {
  await assertSucceeds(setDoc(doc(admin, "muscleGroups", "peito"), { name: "Peito", active: true, sortOrder: 1 }));
  await assertSucceeds(getDoc(doc(userA, "muscleGroups", "peito")));
  await assertFails(getDoc(doc(anonymous, "muscleGroups", "peito")));
  await assertFails(setDoc(doc(userA, "muscleGroups", "costas"), { name: "Costas", active: true }));
  await assertSucceeds(updateDoc(doc(admin, "muscleGroups", "peito"), { active: false }));
});

test("catálogo de métodos é global para autenticados e gravável apenas pelo admin", async () => {
  await assertSucceeds(getDoc(doc(userA, "trainingMethods", "series-normais")));
  await assertFails(getDoc(doc(anonymous, "trainingMethods", "series-normais")));
  await assertFails(updateDoc(doc(userA, "trainingMethods", "series-normais"), { active: false }));
  await assertSucceeds(updateDoc(doc(admin, "trainingMethods", "series-normais"), { active: false }));
});

test("ownerId é obrigatório e imutável", async () => {
  await assertSucceeds(setDoc(doc(userA, "workouts", "new-a"), workout("user-a")));
  await assertFails(setDoc(doc(userA, "workouts", "new-b"), workout("user-b")));
  await assertFails(updateDoc(doc(userA, "workouts", "work-a"), { ownerId: "user-b" }));
});

test("sessão ativa usa um único ID determinístico e histórico não reabre", async () => {
  const activeReference = doc(userA, "workoutSessions", "active-user-a");
  await assertSucceeds(runTransaction(userA, async (transaction) => {
    const existing = await transaction.get(activeReference);
    if (existing.exists()) throw new Error("A sessão ativa deveria começar vazia.");
    transaction.set(activeReference, session("user-a"));
  }));
  await assertFails(getDoc(doc(userB, "workoutSessions", "active-user-a")));
  await assertFails(setDoc(doc(userA, "workoutSessions", "random-active"), session("user-a")));
  await assertSucceeds(setDoc(doc(userA, "workoutSessions", "completed-a"), session("user-a", "completed")));
  await assertFails(updateDoc(doc(userA, "workoutSessions", "completed-a"), { status: "active" }));
});

test("avaliação parcial pode ser criada, editada e excluída pelo dono", async () => {
  const reference = doc(userA, "physicalAssessments", "partial-a");
  await assertSucceeds(setDoc(reference, { ownerId: "user-a", date: "2026-08-18", type: "advanced", measurements: { waist: 90 }, skinfolds: { triceps: 12 } }));
  await assertSucceeds(updateDoc(reference, { notes: "Revisada", measurements: { waist: 89 } }));
  await assertSucceeds(deleteDoc(reference));
});

test("administrador gerencia catálogo e auditoria, mas não acessa dados pessoais", async () => {
  await assertSucceeds(getDocs(collection(admin, "users")));
  for (const name of ["workouts", "workoutSessions", "bodyWeights", "physicalAssessments", "exerciseSubstitutionPreferences"]) await assertFails(getDocs(collection(admin, name)));
  await assertFails(getDoc(doc(admin, "physicalAssessments", "assessment-a")));
  await assertFails(getDoc(doc(admin, "exerciseSubstitutionPreferences", "pref-a")));
  await assertSucceeds(setDoc(doc(admin, "auditLogs", "log-1"), { adminUid: "admin", action: "exercise.update", entityType: "exercise", entityId: "supino", summary: "Teste", timestamp: Timestamp.now() }));
  await assertFails(updateDoc(doc(admin, "auditLogs", "log-1"), { summary: "Alterado" }));
});

test("alternativas preferidas de exercício pertencem exclusivamente ao dono", async () => {
  await assertSucceeds(setDoc(doc(userA, "exerciseSubstitutionPreferences", "new-a"), substitutionPreference("user-a")));
  await assertFails(setDoc(doc(userA, "exerciseSubstitutionPreferences", "new-b"), substitutionPreference("user-b")));
  await assertSucceeds(updateDoc(doc(userA, "exerciseSubstitutionPreferences", "pref-a"), { alternativeExerciseIds: ["supino-maquina", "supino-halteres"] }));
  await assertFails(updateDoc(doc(userA, "exerciseSubstitutionPreferences", "pref-a"), { ownerId: "user-b" }));
  await assertFails(getDoc(doc(userB, "exerciseSubstitutionPreferences", "pref-a")));
  await assertSucceeds(deleteDoc(doc(userA, "exerciseSubstitutionPreferences", "pref-a")));
});

test("coleções não declaradas permanecem fechadas", async () => {
  await assertFails(setDoc(doc(userA, "private", "anything"), { ownerId: "user-a" }));
  await assertFails(getDoc(doc(admin, "private", "anything")));
  await assertFails(getDoc(doc(anonymous, "exercises", "supino")));
});
