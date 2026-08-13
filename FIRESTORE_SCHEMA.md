# Inventário Firestore do XTrainer

> Atualização 13/08/2026: `workoutSessions` possui consulta de sessão ativa (`ownerId` + `status`) e status `cancelled`; `bodyWeights` tem operação de atualização com `updatedAt` opcional.

## `system/config`

- **ID:** fixo `config`.
- **Campos usados:** `initialized:boolean`, `adminUid:string`, `updatedAt:Timestamp`.
- **Leitura:** pública pela regra; usada no login/admin.
- **Criação:** usuário autenticado apenas se não existir.
- **Alteração/exclusão:** somente `adminUid` atual.
- **Telas/services:** login, `getSystemConfig`, `createFirstAdmin`, `loginAsAdmin`.

## `users/{uid}`

- **Owner:** UID no ID do documento.
- **Campos:** `uid`, `name`, `email`, `role`, `createdAt`; perfil também pode gravar `height`, `goal`; type inclui `birthDate`, `sex`, `photoURL` sem fluxo.
- **Leitura:** próprio usuário ou admin.
- **Criação:** próprio UID; role user ou admin somente antes de config.
- **Edição:** admin ou próprio UID sem alterar role (com exceção do primeiro admin).
- **Exclusão:** admin nas Rules, sem UI.
- **Telas/services:** login, providers, perfil, auth.

## `exercises/{id}`

- **ID:** padrão é slug determinístico; personalizados pelo service recebem autoId.
- **Owner:** global, sem `ownerId`.
- **Campos:** `name`, `nameEn?`, `aliases?`, `muscleGroup`, `videoUrl?`, `sortOrder?`, `active`, campos descritivos opcionais, `createdAt`, `updatedAt`.
- **Leitura:** autenticado. **Escrita:** admin.
- **Telas/services:** admin, treino, `exercises.list/save/remove/seedDefaultLibrary`.

## `workouts/{id}`

- **Owner:** `ownerId`.
- **Campos:** `name`, `title`, `description?`, `muscleGroups[]`, `exercises[]`, `active`, timestamps.
- **Exercício interno:** `id`, `exerciseId`, `name`, `order`, `sets`, `repsMin`, `repsMax`, `restSeconds`, `suggestedLoad?`, `notes?`.
- **Leitura/escrita:** owner; admin também lê/edita pelas Rules.
- **Telas/services:** treino, dashboard, admin; `workouts.list/save`.

## `workoutSessions/{id}`

- **Owner:** `ownerId`.
- **Campos:** `workoutId`, `workoutName`, `startedAt`, `endedAt?`, `durationSeconds?`, `status`, `totalVolume`, `totalSets`, `notes?`, `exercises[]`.
- **Snapshot:** exercise session guarda `exerciseId`, `name`, `order`, `target` e `sets[]`; set guarda carga/reps/completed/volume e RPE/RIR opcionais no type.
- **Rules:** coberta pelo match genérico ownerId.
- **Telas/services:** treino, dashboard, histórico; `sessions.list/get/start/save`.

## `bodyWeights/{id}`

- **Owner:** `ownerId`.
- **Campos:** `date` (string), `weight` (number), `note?`, `createdAt`.
- **Rules:** match genérico ownerId.
- **Telas/services:** evolução, dashboard, admin; `weights.list/save/remove`.
- **Índice:** ownerId ASC + date ASC.

## `physicalAssessments/{id}`

- **Owner:** `ownerId`.
- **Campos type:** date, type, weight?, height?, bodyFat?, leanMass?, measurements, notes?, photos?, createdAt.
- **Rules:** match genérico ownerId.
- **Service:** `assessments.list/save`; sem tela/menu.

## Collections apenas previstas

`personalRecords` é citado na especificação/documentação anterior, mas não há type/service/UI nem regra específica encontrada; cairia na regra genérica se tiver ownerId.
