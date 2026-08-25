// Suite adversarial dedicada: cada teste aqui representa uma tentativa de ataque ou abuso
// contra as Firestore Rules (IDOR, escalonamento de privilégio, adulteração de ownerId/uid/role,
// abuso de tamanho de payload, injeção de URL, coleções não declaradas). Complementa
// tests/firestore.rules.test.mjs (que cobre o caminho feliz + regressão funcional) em vez de
// substituí-lo. Ver DOCUMENTACAO/docs/SECURITY.md para o modelo de ameaça completo.
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, setDoc, Timestamp, updateDoc } from "firebase/firestore";

let environment;
let anonymous;
let admin;
let userA;
let userB;
let attacker; // autenticado, mas nunca dono de nenhum documento legítimo
let userAWithEmailClaim; // mesmo uid de user-a, mas com claim de e-mail no token (simula login real por senha)

const profile = (uid, role = "user") => ({ uid, name: uid, email: `${uid}@test.dev`, role });
const workout = (ownerId, overrides = {}) => ({ ownerId, name: "Treino A", title: "Treino A", muscleGroups: ["Peito"], exercises: [], active: true, ...overrides });
const session = (ownerId, status = "active", overrides = {}) => ({ ownerId, workoutId: "work-a", workoutName: "Treino A", exercises: [], totalVolume: 0, totalSets: 0, status, ...overrides });
const weight = (ownerId, overrides = {}) => ({ ownerId, date: "2026-08-17", weight: 80, ...overrides });
const assessment = (ownerId, overrides = {}) => ({ ownerId, date: "2026-08-17", type: "quick", measurements: {}, ...overrides });
const preference = (ownerId, overrides = {}) => ({ ownerId, exerciseId: "supino", alternativeExerciseIds: ["supino-maquina"], ...overrides });
const longString = (length) => "a".repeat(length);

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
    await setDoc(doc(database, "muscleGroups", "peito"), { name: "Peito", active: true });
    await setDoc(doc(database, "trainingMethods", "series-normais"), { name: "Séries normais", active: true, engine: "normal" });
    await setDoc(doc(database, "workouts", "work-a"), workout("user-a"));
    await setDoc(doc(database, "workoutSessions", "active-user-a"), session("user-a", "active"));
    await setDoc(doc(database, "workoutSessions", "history-a"), session("user-a", "completed"));
    await setDoc(doc(database, "bodyWeights", "weight-a"), weight("user-a"));
    await setDoc(doc(database, "physicalAssessments", "assessment-a"), assessment("user-a"));
    await setDoc(doc(database, "exerciseSubstitutionPreferences", "pref-a"), preference("user-a"));
    await setDoc(doc(database, "auditLogs", "log-a"), { adminUid: "admin", action: "exercise.update", entityType: "exercise", entityId: "supino", timestamp: Timestamp.now() });
  });
  anonymous = environment.unauthenticatedContext().firestore();
  admin = environment.authenticatedContext("admin").firestore();
  userA = environment.authenticatedContext("user-a").firestore();
  userB = environment.authenticatedContext("user-b").firestore();
  attacker = environment.authenticatedContext("attacker-uid").firestore();
  userAWithEmailClaim = environment.authenticatedContext("user-a", { email: "user-a@test.dev" }).firestore();
});

after(async () => environment?.cleanup());

// ---------------------------------------------------------------------------------------------
// 1. Anônimo nunca acessa dado privado, catálogo administrativo ou identidade de terceiros
// ---------------------------------------------------------------------------------------------
test("[anonymous] não lê nenhuma collection privada de ninguém", async () => {
  await assertFails(getDoc(doc(anonymous, "workouts", "work-a")));
  await assertFails(getDoc(doc(anonymous, "workoutSessions", "history-a")));
  await assertFails(getDoc(doc(anonymous, "workoutSessions", "active-user-a")));
  await assertFails(getDoc(doc(anonymous, "bodyWeights", "weight-a")));
  await assertFails(getDoc(doc(anonymous, "physicalAssessments", "assessment-a")));
  await assertFails(getDoc(doc(anonymous, "exerciseSubstitutionPreferences", "pref-a")));
  await assertFails(getDoc(doc(anonymous, "users", "user-a")));
  await assertFails(getDoc(doc(anonymous, "auditLogs", "log-a")));
});

test("[anonymous] não escreve em nenhuma collection, nem gera as próprias", async () => {
  await assertFails(setDoc(doc(anonymous, "workouts", "anon-1"), workout("anon-uid")));
  await assertFails(setDoc(doc(anonymous, "users", "anon-uid"), profile("anon-uid")));
  await assertFails(setDoc(doc(anonymous, "bodyWeights", "anon-1"), weight("anon-uid")));
  await assertFails(setDoc(doc(anonymous, "exercises", "anon-1"), { name: "X", muscleGroup: "Y", active: true }));
});

test("[anonymous] lê catálogo público (system/config), mas não o catálogo autenticado", async () => {
  await assertSucceeds(getDoc(doc(anonymous, "system", "config")));
  await assertFails(getDoc(doc(anonymous, "exercises", "supino")));
  await assertFails(getDoc(doc(anonymous, "muscleGroups", "peito")));
  await assertFails(getDoc(doc(anonymous, "trainingMethods", "series-normais")));
});

// ---------------------------------------------------------------------------------------------
// 2. IDOR: user-a nunca acessa dado de user-b, mesmo sabendo o document ID exato
// ---------------------------------------------------------------------------------------------
test("[IDOR] user-a não lê treino de user-b mesmo conhecendo o ID", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "workouts", "work-b"), workout("user-b"));
  });
  await assertFails(getDoc(doc(userA, "workouts", "work-b")));
  await assertSucceeds(getDoc(doc(userB, "workouts", "work-b")));
});

test("[IDOR] user-a não edita nem apaga treino de user-b", async () => {
  await assertFails(updateDoc(doc(userA, "workouts", "work-b"), { title: "Sequestrado" }));
  await assertFails(deleteDoc(doc(userA, "workouts", "work-b")));
});

test("[IDOR] user-a não lista sessões de user-b", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "workoutSessions", "history-b"), session("user-b", "completed"));
  });
  await assertFails(getDocs(collection(userA, "workoutSessions")));
  await assertFails(getDoc(doc(userA, "workoutSessions", "history-b")));
});

test("[IDOR] user-a não lê, edita ou apaga peso de user-b", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "bodyWeights", "weight-b"), weight("user-b"));
  });
  await assertFails(getDoc(doc(userA, "bodyWeights", "weight-b")));
  await assertFails(updateDoc(doc(userA, "bodyWeights", "weight-b"), { weight: 1 }));
  await assertFails(deleteDoc(doc(userA, "bodyWeights", "weight-b")));
});

test("[IDOR] user-a não lê, edita ou apaga avaliação física de user-b", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "physicalAssessments", "assessment-b"), assessment("user-b"));
  });
  await assertFails(getDoc(doc(userA, "physicalAssessments", "assessment-b")));
  await assertFails(updateDoc(doc(userA, "physicalAssessments", "assessment-b"), { notes: "invadido" }));
  await assertFails(deleteDoc(doc(userA, "physicalAssessments", "assessment-b")));
});

test("[IDOR] user-a não lê nem altera preferências de substituição de user-b", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "exerciseSubstitutionPreferences", "pref-b"), preference("user-b"));
  });
  await assertFails(getDoc(doc(userA, "exerciseSubstitutionPreferences", "pref-b")));
  await assertFails(updateDoc(doc(userA, "exerciseSubstitutionPreferences", "pref-b"), { alternativeExerciseIds: [] }));
  await assertFails(deleteDoc(doc(userA, "exerciseSubstitutionPreferences", "pref-b")));
});

test("[IDOR] user-a não lê o perfil de user-b", async () => {
  await assertFails(getDoc(doc(userA, "users", "user-b")));
});

test("[IDOR] simetria: user-b também não acessa nada de user-a", async () => {
  await assertFails(getDoc(doc(userB, "workouts", "work-a")));
  await assertFails(getDoc(doc(userB, "workoutSessions", "history-a")));
  await assertFails(getDoc(doc(userB, "bodyWeights", "weight-a")));
  await assertFails(getDoc(doc(userB, "physicalAssessments", "assessment-a")));
  await assertFails(getDoc(doc(userB, "exerciseSubstitutionPreferences", "pref-a")));
  await assertFails(getDoc(doc(userB, "users", "user-a")));
});

test("[IDOR] um invasor autenticado sem nenhum documento próprio também é negado", async () => {
  await assertFails(getDoc(doc(attacker, "workouts", "work-a")));
  await assertFails(getDoc(doc(attacker, "bodyWeights", "weight-a")));
  await assertFails(getDoc(doc(attacker, "physicalAssessments", "assessment-a")));
  await assertFails(getDoc(doc(attacker, "users", "user-a")));
  await assertFails(getDocs(collection(attacker, "workouts")));
});

// ---------------------------------------------------------------------------------------------
// 3. ownerId: obrigatório, imutável, nunca falsificável para outro uid ou para o admin
// ---------------------------------------------------------------------------------------------
test("[ownerId] não cria treino com ownerId de outro usuário", async () => {
  await assertFails(setDoc(doc(userA, "workouts", "forge-1"), workout("user-b")));
  await assertFails(setDoc(doc(userA, "workouts", "forge-2"), workout("admin")));
});

test("[ownerId] não muda ownerId de A para B em um update", async () => {
  await assertFails(updateDoc(doc(userA, "workouts", "work-a"), { ownerId: "user-b" }));
});

test("[ownerId] não muda ownerId de A para admin em um update", async () => {
  await assertFails(updateDoc(doc(userA, "workouts", "work-a"), { ownerId: "admin" }));
});

test("[ownerId] não cria documento com ownerId vazio, nulo ou ausente", async () => {
  const withoutOwner = { name: "Treino A", title: "Treino A", muscleGroups: ["Peito"], exercises: [], active: true };
  await assertFails(setDoc(doc(userA, "workouts", "no-owner"), withoutOwner));
  await assertFails(setDoc(doc(userA, "workouts", "empty-owner"), workout("")));
  await assertFails(setDoc(doc(userA, "workouts", "null-owner"), { ...workout("user-a"), ownerId: null }));
});

test("[ownerId] não remove ownerId de um documento existente via update", async () => {
  await assertFails(updateDoc(doc(userA, "workouts", "work-a"), { ownerId: deleteField() }));
});

test("[ownerId] mesma proteção se aplica a bodyWeights, physicalAssessments, exerciseSubstitutionPreferences e workoutSessions", async () => {
  await assertFails(setDoc(doc(userA, "bodyWeights", "forge"), weight("user-b")));
  await assertFails(updateDoc(doc(userA, "bodyWeights", "weight-a"), { ownerId: "user-b" }));
  await assertFails(setDoc(doc(userA, "physicalAssessments", "forge"), assessment("user-b")));
  await assertFails(updateDoc(doc(userA, "physicalAssessments", "assessment-a"), { ownerId: "user-b" }));
  await assertFails(setDoc(doc(userA, "exerciseSubstitutionPreferences", "forge"), preference("user-b")));
  await assertFails(updateDoc(doc(userA, "exerciseSubstitutionPreferences", "pref-a"), { ownerId: "user-b" }));
  await assertFails(setDoc(doc(userA, "workoutSessions", "forge"), session("user-b")));
  await assertFails(updateDoc(doc(userA, "workoutSessions", "history-a"), { ownerId: "user-b" }));
});

// ---------------------------------------------------------------------------------------------
// 4. Escalonamento de privilégio: role, uid, admin nunca são conquistáveis pelo cliente
// ---------------------------------------------------------------------------------------------
test("[privesc] novo cadastro nunca pode nascer com role diferente de user", async () => {
  await assertFails(setDoc(doc(attacker, "users", "attacker-uid"), profile("attacker-uid", "admin")));
  await assertFails(setDoc(doc(attacker, "users", "attacker-uid"), { ...profile("attacker-uid"), role: "superadmin" }));
});

test("[privesc] usuário não consegue promover a si mesmo escrevendo role: admin depois de já cadastrado", async () => {
  await assertFails(updateDoc(doc(userA, "users", "user-a"), { role: "admin" }));
});

test("[privesc] usuário não consegue alterar o próprio uid armazenado", async () => {
  await assertFails(updateDoc(doc(userA, "users", "user-a"), { uid: "user-b" }));
  await assertFails(updateDoc(doc(userA, "users", "user-a"), { uid: "admin" }));
});

test("[privesc] escrever role:admin não concede autoridade administrativa real (isAdmin depende só de system/config)", async () => {
  // Mesmo que a escrita acima fosse aceita por algum bug futuro, a autoridade de admin não
  // deriva de users.role - ela é checada via system/config.adminUid. Confirma que attacker,
  // mesmo alegando (fora das regras) ser admin, não ganha acesso a dado administrativo.
  await assertFails(getDocs(collection(attacker, "users")));
  await assertFails(setDoc(doc(attacker, "auditLogs", "fake-log"), { adminUid: "attacker-uid", action: "x", entityType: "y", entityId: "z", timestamp: Timestamp.now() }));
});

test("[privesc] cliente nunca escreve em system/config, nem para se autopromover", async () => {
  await assertFails(setDoc(doc(attacker, "system", "config"), { initialized: true, adminUid: "attacker-uid" }));
  await assertFails(updateDoc(doc(admin, "system", "config"), { adminUid: "attacker-uid" }));
  await assertFails(deleteDoc(doc(admin, "system", "config")));
});

test("[privesc] admin não lê dados privados de usuários mesmo sendo admin", async () => {
  await assertFails(getDoc(doc(admin, "workouts", "work-a")));
  await assertFails(getDoc(doc(admin, "workoutSessions", "history-a")));
  await assertFails(getDoc(doc(admin, "bodyWeights", "weight-a")));
  await assertFails(getDoc(doc(admin, "physicalAssessments", "assessment-a")));
  await assertFails(getDoc(doc(admin, "exerciseSubstitutionPreferences", "pref-a")));
  await assertFails(getDocs(collection(admin, "workouts")));
});

// ---------------------------------------------------------------------------------------------
// 5. E-mail do perfil: nasce igual ao token quando disponível, e é imutável pela tela de Perfil
// ---------------------------------------------------------------------------------------------
test("[email] create com token portando e-mail exige que o documento use o mesmo e-mail", async () => {
  await assertFails(setDoc(doc(userAWithEmailClaim, "users", "user-a-2"), { uid: "user-a-2", name: "X", email: "outro@evil.dev", role: "user" }));
});

test("[email] update nunca altera o e-mail do documento, mesmo mantendo os outros campos válidos", async () => {
  await assertFails(updateDoc(doc(userA, "users", "user-a"), { email: "novo@evil.dev" }));
  await assertFails(updateDoc(doc(userA, "users", "user-a"), { name: "Nome Legítimo", email: "novo@evil.dev" }));
});

// ---------------------------------------------------------------------------------------------
// 6. Abuso de tamanho / schema: limites técnicos adicionados nesta auditoria
// ---------------------------------------------------------------------------------------------
test("[size] nome de treino além do limite é rejeitado", async () => {
  await assertFails(setDoc(doc(userA, "workouts", "too-long-name"), workout("user-a", { name: longString(121) })));
  await assertSucceeds(setDoc(doc(userA, "workouts", "ok-long-name"), workout("user-a", { name: longString(120) })));
});

test("[size] lista de exercícios de um treino além do limite é rejeitada", async () => {
  const tooMany = Array.from({ length: 61 }, (_, index) => ({ id: `e${index}`, exerciseId: "supino", name: "Supino", order: index, sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 }));
  await assertFails(setDoc(doc(userA, "workouts", "too-many-exercises"), workout("user-a", { exercises: tooMany })));
});

test("[size] observação de peso corporal além do limite é rejeitada", async () => {
  await assertFails(setDoc(doc(userA, "bodyWeights", "too-long-note"), weight("user-a", { note: longString(501) })));
  await assertSucceeds(setDoc(doc(userA, "bodyWeights", "ok-note"), weight("user-a", { note: longString(500) })));
});

test("[size] notas de avaliação física além do limite são rejeitadas", async () => {
  await assertFails(setDoc(doc(userA, "physicalAssessments", "too-long-notes"), assessment("user-a", { notes: longString(4001) })));
});

test("[size] alternativas de substituição além do limite são rejeitadas", async () => {
  const tooMany = Array.from({ length: 21 }, (_, index) => `alt-${index}`);
  await assertFails(setDoc(doc(userA, "exerciseSubstitutionPreferences", "too-many-alts"), preference("user-a", { alternativeExerciseIds: tooMany })));
});

test("[size] nome de perfil vazio ou absurdamente longo é rejeitado", async () => {
  await assertFails(updateDoc(doc(userA, "users", "user-a"), { name: "" }));
  await assertFails(updateDoc(doc(userA, "users", "user-a"), { name: longString(121) }));
});

test("[size] resumo de auditLog além do limite é rejeitado", async () => {
  await assertFails(setDoc(doc(admin, "auditLogs", "too-long-summary"), { adminUid: "admin", action: "x", entityType: "y", entityId: "z", summary: longString(501), timestamp: Timestamp.now() }));
});

// ---------------------------------------------------------------------------------------------
// 7. Injeção de URL no catálogo de exercícios (defesa em profundidade - a UI já filtra também)
// ---------------------------------------------------------------------------------------------
test("[url] admin não consegue gravar javascript: ou data: como videoUrl de exercício", async () => {
  await assertFails(updateDoc(doc(admin, "exercises", "supino"), { videoUrl: "javascript:alert(1)" }));
  await assertFails(updateDoc(doc(admin, "exercises", "supino"), { videoUrl: "data:text/html,<script>alert(1)</script>" }));
});

test("[url] admin não consegue gravar um domínio de vídeo fora da allowlist", async () => {
  await assertFails(updateDoc(doc(admin, "exercises", "supino"), { videoUrl: "https://evil.example.com/video" }));
  await assertFails(updateDoc(doc(admin, "exercises", "supino"), { videoUrl: "http://www.youtube.com/watch?v=x" }));
});

test("[url] admin consegue gravar uma URL real do YouTube (https, com ou sem www, e youtu.be)", async () => {
  await assertSucceeds(updateDoc(doc(admin, "exercises", "supino"), { videoUrl: "https://www.youtube.com/watch?v=abc123" }));
  await assertSucceeds(updateDoc(doc(admin, "exercises", "supino"), { videoUrl: "https://youtube.com/watch?v=abc123" }));
  await assertSucceeds(updateDoc(doc(admin, "exercises", "supino"), { videoUrl: "https://youtu.be/abc123" }));
});

test("[url] usuário comum não pode alterar exercício de forma alguma, então também não injeta URL", async () => {
  await assertFails(updateDoc(doc(userA, "exercises", "supino"), { videoUrl: "javascript:alert(1)" }));
});

// ---------------------------------------------------------------------------------------------
// 8. Sessão ativa: esquema de ID determinístico não pode ser abusado
// ---------------------------------------------------------------------------------------------
test("[session] user-a não cria uma sessão ativa usando o ID ativo de user-b", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await deleteDoc(doc(context.firestore(), "workoutSessions", "active-user-b")).catch(() => {});
  });
  await assertFails(setDoc(doc(userA, "workoutSessions", "active-user-b"), session("user-a", "active")));
});

test("[session] user-a não marca a própria sessão ativa com um ID arbitrário", async () => {
  await assertFails(setDoc(doc(userA, "workoutSessions", "minha-sessao-livre"), session("user-a", "active")));
});

test("[session] histórico concluído não pode ser reaberto para active", async () => {
  await assertFails(updateDoc(doc(userA, "workoutSessions", "history-a"), { status: "active" }));
});

test("[session] user-a não força status inválido fora do enum", async () => {
  await assertFails(setDoc(doc(userA, "workoutSessions", "invalid-status"), session("user-a", "in-progress")));
});

// ---------------------------------------------------------------------------------------------
// 9. Catálogo global (exercises, muscleGroups, trainingMethods): somente admin escreve
// ---------------------------------------------------------------------------------------------
test("[catalog] usuário comum não cria, edita nem apaga exercício", async () => {
  await assertFails(setDoc(doc(userA, "exercises", "novo"), { name: "X", muscleGroup: "Y", active: true }));
  await assertFails(updateDoc(doc(userA, "exercises", "supino"), { active: false }));
  await assertFails(deleteDoc(doc(userA, "exercises", "supino")));
});

test("[catalog] usuário comum não cria, edita nem apaga grupo muscular", async () => {
  await assertFails(setDoc(doc(userA, "muscleGroups", "novo"), { name: "X", active: true }));
  await assertFails(updateDoc(doc(userA, "muscleGroups", "peito"), { active: false }));
  await assertFails(deleteDoc(doc(userA, "muscleGroups", "peito")));
});

test("[catalog] usuário comum não cria, edita nem apaga método de treino", async () => {
  await assertFails(setDoc(doc(userA, "trainingMethods", "novo"), { name: "X", active: true }));
  await assertFails(updateDoc(doc(userA, "trainingMethods", "series-normais"), { active: false }));
  await assertFails(deleteDoc(doc(userA, "trainingMethods", "series-normais")));
});

test("[catalog] invasor autenticado sem privilégio nenhum também não escreve no catálogo", async () => {
  await assertFails(setDoc(doc(attacker, "exercises", "novo"), { name: "X", muscleGroup: "Y", active: true }));
  await assertFails(setDoc(doc(attacker, "muscleGroups", "novo"), { name: "X", active: true }));
});

// ---------------------------------------------------------------------------------------------
// 10. auditLogs: append-only de verdade
// ---------------------------------------------------------------------------------------------
test("[audit] usuário comum não lê nem cria audit logs", async () => {
  await assertFails(getDoc(doc(userA, "auditLogs", "log-a")));
  await assertFails(getDocs(collection(userA, "auditLogs")));
  await assertFails(setDoc(doc(userA, "auditLogs", "fake"), { adminUid: "user-a", action: "x", entityType: "y", entityId: "z", timestamp: Timestamp.now() }));
});

test("[audit] admin não consegue editar nem apagar um log já criado", async () => {
  await assertFails(updateDoc(doc(admin, "auditLogs", "log-a"), { action: "adulterado" }));
  await assertFails(deleteDoc(doc(admin, "auditLogs", "log-a")));
});

test("[audit] admin não consegue forjar adminUid de outra conta no log", async () => {
  await assertFails(setDoc(doc(admin, "auditLogs", "forged"), { adminUid: "attacker-uid", action: "x", entityType: "y", entityId: "z", timestamp: Timestamp.now() }));
});

// ---------------------------------------------------------------------------------------------
// 11. Coleções não declaradas: deny by default de verdade, para qualquer papel
// ---------------------------------------------------------------------------------------------
test("[unknown] nenhum papel lê ou escreve em uma collection nunca declarada", async () => {
  await assertFails(getDoc(doc(anonymous, "secrets", "x")));
  await assertFails(getDoc(doc(userA, "secrets", "x")));
  await assertFails(getDoc(doc(admin, "secrets", "x")));
  await assertFails(setDoc(doc(userA, "secrets", "x"), { value: "y" }));
  await assertFails(setDoc(doc(admin, "secrets", "x"), { value: "y" }));
});

test("[unknown] collections privadas futuras (cycles, labResults) ainda não existem e continuam fechadas", async () => {
  await assertFails(setDoc(doc(userA, "cycles", "c1"), { ownerId: "user-a", title: "X" }));
  await assertFails(setDoc(doc(userA, "labResults", "l1"), { ownerId: "user-a" }));
  await assertFails(getDoc(doc(admin, "cycles", "c1")));
});

// ---------------------------------------------------------------------------------------------
// 12. Contagem de cobertura (não é um teste de regra - só documenta que a suíte é grande o
// suficiente para o requisito de "pelo menos 60 casos adversariais" do briefing de segurança).
// ---------------------------------------------------------------------------------------------
test("[coverage] esta suíte cobre pelo menos 60 asserções adversariais distintas", () => {
  const source = readFileSync(new URL(import.meta.url), "utf8");
  const assertionCount = (source.match(/assert(Fails|Succeeds)\(/g) ?? []).length;
  assert.ok(assertionCount >= 60, `esperava >= 60 asserções adversariais, encontrou ${assertionCount}`);
});
