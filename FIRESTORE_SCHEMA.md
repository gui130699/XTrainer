# Esquema Firestore compartilhado — XTrainer

Atualizado em 22/08/2026. Os dois PWAs usam o projeto Firebase `xtrainer-45f8d`. Campos marcados com `?` são opcionais para preservar documentos antigos.

## Princípios

- `ownerId` é obrigatório e imutável em dados privados.
- A autorização administrativa deriva de `system/config.adminUid`, nunca de um botão ou parâmetro de rota.
- O navegador não cria, altera ou exclui `system/config`.
- Admin pode gerenciar `exercises` e ler identificação em `users`, mas não dados de treino/corpo.
- IDs do catálogo existente não são renomeados.
- Timestamps de criação/finalização usam o servidor sempre que a operação ocorre online.
- Campos novos permanecem opcionais ou são normalizados pelos readers de compatibilidade.

## `system/config`

ID fixo: `config`.

| Campo | Tipo | Obrigatório | Observação |
|---|---|---:|---|
| `initialized` | boolean | sim | indica provisionamento |
| `adminUid` | string | sim | UID administrativo único |
| `updatedAt` | Timestamp | não | auditoria de provisionamento |

Leitura pública para permitir decidir a experiência de login. Escrita sempre negada ao cliente. Provisione pelo Console/Admin SDK.

## `users/{uid}`

| Campo | Tipo | Obrigatório |
|---|---|---:|
| `uid` | string | sim |
| `name` | string | sim |
| `email` | string | sim |
| `role` | `user \| admin` | sim |
| `birthDate` | string ISO date | não |
| `height` | number cm | não |
| `sex` | string | não |
| `goal` | string | não |
| `createdAt` | Timestamp | não |
| `updatedAt` | Timestamp | não |

Usuário cria o próprio documento apenas com `role: user`, lê o próprio e altera somente campos editáveis sem trocar UID/papel. Admin pode listar contas, mas a UI mostra somente identificação mínima.

## `exercises/{exerciseId}`

| Campo | Tipo | Obrigatório |
|---|---|---:|
| `name` | string | sim |
| `nameEn` | string | não |
| `aliases` | string[] | não |
| `muscleGroup` | string | sim |
| `muscleSubgroup` | string | não |
| `equipment` | string | não |
| `videoUrl` | string | não |
| `sortOrder` | number | não |
| `description` | string | não |
| `instructions` | string | não |
| `notes` | string | não |
| `active` | boolean | sim |
| `createdAt`, `updatedAt` | Timestamp | não |

Catálogo global. Autenticados leem; somente `adminUid` escreve. O seed contém 202 IDs determinísticos, valida duplicidades/ordem/URLs e preserva `active` em documentos existentes.

## `workouts/{workoutId}`

| Campo | Tipo | Obrigatório |
|---|---|---:|
| `ownerId` | string | sim |
| `name`, `title` | string | sim |
| `description` | string | não |
| `muscleGroups` | string[] | sim |
| `exercises` | WorkoutExercise[] | sim |
| `active` | boolean | sim |
| `createdAt`, `updatedAt` | Timestamp | não |

`WorkoutExercise`: `id`, `exerciseId`, `name`, `order`, `sets`, `repsMin`, `repsMax`, `restSeconds`; `suggestedLoad?`, `notes?`.

Somente o owner lê/escreve. Arquivamento usa `active: false`; exclusão do treino não apaga sessões históricas.

## `workoutSessions/{sessionId}`

| Campo | Tipo | Obrigatório |
|---|---|---:|
| `ownerId` | string | sim |
| `workoutId`, `workoutName` | string | sim |
| `startedAt` | Timestamp | recomendado |
| `endedAt` | Timestamp | não |
| `durationSeconds` | number | não |
| `restEndsAt` | Timestamp | não |
| `exercises` | SessionExercise[] | sim |
| `totalVolume`, `totalSets` | number | sim |
| `status` | `active \| completed \| cancelled` | sim |
| `notes` | string | não |

Sessão ativa usa ID fixo `active-{uid}`. O início é transacional. Ao finalizar/cancelar, uma transação cria um documento histórico com auto-ID e remove o ativo. Um histórico `completed/cancelled` não pode voltar a `active`.

`SessionExercise` contém snapshot de `exerciseId`, nome, ordem, alvo e sets. `TrainingSet`: `id`, `load`, `reps`, `completed`, `volume`; `rpe?`, `rir?`, `completedAt?`.

Volume canônico: soma de `load * reps` somente para séries `completed === true`. Recordes e gráficos usam somente sessões `status === completed`.

## `bodyWeights/{weightId}`

| Campo | Tipo | Obrigatório |
|---|---|---:|
| `ownerId` | string | sim |
| `date` | string ISO date | sim |
| `weight` | number positivo | sim |
| `note` | string | não |
| `source` | `manual \| assessment` | não |
| `assessmentId` | string | não |
| `createdAt`, `updatedAt` | Timestamp | não |

Somente o owner. `assessmentId` evita duplicar uma pesagem criada a partir da mesma avaliação.

## `physicalAssessments/{assessmentId}`

| Campo | Tipo | Obrigatório |
|---|---|---:|
| `ownerId` | string | sim |
| `date` | string ISO date | sim |
| `type` | `quick \| complete \| advanced` | sim em novos docs |
| `weight`, `height`, `bodyFat` | number | não |
| `fatMass`, `leanMass` | number | não |
| `measurements` | map number | sim em novos docs |
| `skinfolds` | map number | não |
| `assessmentProtocol` | string | não |
| `notes` | string | não |
| `createdAt`, `updatedAt` | Timestamp | não |

Todos os dados corporais são opcionais e privados. Readers inferem `quick/complete` e `{}` para documentos antigos sem campos novos. O sistema não inventa fórmula de percentual de gordura.

Medidas reconhecidas: pescoço, ombros, peitoral, braços relaxados/flexionados, antebraços, cintura, abdômen, quadril, coxas e panturrilhas.

Dobras reconhecidas: tríceps, bíceps, subescapular, supra-ilíaca, abdominal, peitoral, axilar média, coxa e panturrilha.

## `auditLogs/{logId}`

Campos obrigatórios: `adminUid`, `action`, `entityType`, `entityId`, `timestamp`; `summary` opcional/string/null. Admin cria e lê; ninguém altera ou exclui. Falha de auditoria gera aviso visível sem ocultar o resultado da ação principal.

## Storage

O projeto não usa Firebase Storage. Fotos de perfil e de avaliação física foram removidas (o plano gratuito do Firebase não comporta Storage); não existe `storage.rules` em nenhum dos dois repositórios.

## `therapies/{therapyId}`

Coleção privada (Saúde e Terapias). Registro de terapias/medicações já prescritas ou informadas pelo próprio usuário — o app não prescreve, não recomenda substância, não determina dose nem frequência.

| Campo | Tipo | Obrigatório |
|---|---|---:|
| `ownerId` | string | sim |
| `name` | string | sim |
| `startDate` | string ISO date | sim |
| `endDate` | string ISO date | não (ausente quando `continuous: true`) |
| `continuous` | boolean | sim |
| `status` | `active \| paused \| completed` | sim |
| `medications` | `TherapyMedication[]` | sim, ao menos 1 item |
| `notes` | string | não |
| `reminderOffsetDays` | number (0, 1 ou 2) | não |
| `createdAt`, `updatedAt` | Timestamp | não |

`TherapyMedication`: `id`, `name`, `schedule` (`MedicationSchedule`); `formulation?`, `reportedAmount?`, `reportedUnit?`, `notes?`. A quantidade e a frequência são sempre informadas pelo usuário — o sistema nunca calcula ou sugere valores.

`MedicationSchedule` é uma união discriminada por `type`: `interval` (`intervalDays`), `weekdays` (`weekdays: number[]`, 0=domingo…6=sábado) ou `custom` (`dates: string[]`).

O calendário futuro é sempre calculado localmente (`src/lib/therapy-schedule.ts`) a partir de `startDate`/`endDate`/`continuous`/`schedule`; nenhuma data futura é persistida no Firestore.

Somente o owner lê/escreve. Admin nunca acessa esta coleção.

## `therapyAdministrations/{administrationId}`

Coleção privada. Um documento é criado somente quando o usuário confirma, pula ou adia uma administração prevista — nunca para datas futuras ainda não resolvidas.

| Campo | Tipo | Obrigatório |
|---|---|---:|
| `ownerId` | string | sim |
| `therapyId` | string | sim |
| `medicationId` | string | sim |
| `scheduledDate` | string ISO date | sim |
| `actualDate` | string ISO date | não |
| `status` | `completed \| skipped \| postponed` | sim |
| `reportedAmount` | number | não |
| `reportedUnit` | string | não |
| `notes` | string | não |
| `createdAt`, `updatedAt` | Timestamp | não |

Somente o owner lê/escreve. Admin nunca acessa esta coleção.

## `substanceReferences/{substanceId}`

Biblioteca educativa global, arquiteturalmente separada do registro privado de terapias — não há vínculo automático entre as duas. Não contém dose, intervalo, ciclo, stack nem combinação recomendada.

| Campo | Tipo | Obrigatório |
|---|---|---:|
| `name` | string | sim |
| `canonicalName` | string | não |
| `aliases` | string[] | não |
| `class` | string | não |
| `description` | string | sim |
| `mechanismSummary` | string | não |
| `medicalUseSummary` | string | não |
| `riskTags` | `SubstanceReferenceRiskTag[]` | sim (pode ser vazio) |
| `sources` | string[] | não |
| `active` | boolean | sim |
| `isSystem` | boolean | sim |
| `sortOrder` | number | sim |
| `createdAt`, `updatedAt` | Timestamp | não |

`SubstanceReferenceRiskTag`: `cardiovascular \| hepatic \| renal \| endocrine \| psychiatric \| dermatologic \| allergic \| metabolic \| hematologic \| unknown-long-term`. As tags marcam categorias de atenção; não representam veredito de segurança nem justificam recomendação de uso conjunto.

`analyzeSubstanceReferenceOverlap` (`src/lib/substance-analysis.ts`) apenas conta tags compartilhadas entre substâncias selecionadas pelo usuário na tela de referência; não classifica combinações como seguras/inseguras.

Leitura: qualquer autenticado. Escrita: somente `adminUid`.

## Índices compostos

- `workoutSessions`: `ownerId ASC, startedAt DESC`;
- `workoutSessions`: `ownerId ASC, status ASC`;
- `workoutSessions`: `ownerId ASC, status ASC, startedAt DESC`;
- `bodyWeights`: `ownerId ASC, date ASC`;
- `physicalAssessments`: `ownerId ASC, date DESC`.

`therapies` e `therapyAdministrations` não exigem índice composto: as consultas filtram somente por `ownerId` (índice automático de campo único) e ordenam/filtram no cliente.

## Retrocompatibilidade

`src/lib/compatibility.ts` normaliza exercises, workouts, sessions, bodyWeights e assessments antigos. Não existe migração destrutiva automática. Sessões ativas antigas com auto-ID são migradas transacionalmente para `active-{uid}`; duplicatas são canceladas.

## Coleções deliberadamente inexistentes

Não existe `personalRecords`. Recordes são derivados em leitura de `workoutSessions`. Não há coleção pública de bootstrap/admin. Coleções desconhecidas são negadas por ausência de regra.


## Catálogo dinâmico de métodos (versão 2026-08-18)

### `trainingMethods/{methodId}`

Documento global legível por qualquer usuário autenticado e gravável somente pelo administrador.

Campos obrigatórios:

- `id: string`
- `name: string`
- `shortDescription: string`
- `fullDescription: string`
- `category: traditional | warmup | group | intensity | progression | tempo | failure | time | advanced`
- `engine: normal | group | drop | rest-pause | cluster | progression | top-backoff | tempo | failure | amrap | isometric | partials | myo-reps | time`
- `iconKey: string`
- `order: number`
- `active: boolean`
- `system: boolean`
- `version: number`
- `capabilities: map`
- `exerciseRules: { minExercises, maxExercises, sameMuscleGroup? }`
- `configFields: list`
- `defaults: map`

Cada item de `configFields` usa apenas os tipos declarativos permitidos no contrato. Não são armazenados scripts nem marcação executável.

### Extensão de `workouts`

`WorkoutExercise` aceita `methodConfig`, `methodSnapshot`, `groupId` e `groupPosition`. O documento de treino aceita `exerciseGroups`, lista de:

```text
{
  id, name, order, exerciseIds,
  methodConfig,
  methodSnapshot
}
```

### Extensão de `workoutSessions`

A sessão aceita `exerciseGroups`. Cada `TrainingSet` pode registrar:

`methodId`, `methodEngine`, `methodVersion`, `blockId`, `blockIndex`, `stageIndex`, `stageCount`, `setRole`, `durationSeconds`, `tempo`, `restAfterSeconds` e `toFailure`.

Todos os novos campos internos são opcionais para manter leitura de documentos antigos. Ausência de método é normalizada como “Séries normais”.

### Política de snapshot

O catálogo é a definição atual; treino e sessão guardam snapshots. Edições ou desativações futuras não reescrevem dados privados nem históricos.

### Regras

- `trainingMethods.read`: `signedIn()`
- `trainingMethods.create/update/delete`: `isAdmin()`
- `workouts` e `workoutSessions`: continuam restritos ao `ownerId`
