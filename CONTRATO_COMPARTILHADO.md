# Contrato compartilhado XTrainer ↔ XTrainer Admin

## Fonte canônica e política

O Firebase é único (`xtrainer-45f8d`). O XTrainer Admin é a referência operacional para administração do catálogo, mas os seguintes arquivos devem permanecer byte a byte equivalentes, desconsiderando final de linha:

- `firestore.rules`;
- `firestore.indexes.json`;
- `src/types/index.ts`;
- `src/data/default-exercises.ts`;
- `src/data/default-training-methods.ts`.

O projeto não usa Firebase Storage (fotos foram removidas); não existe `storage.rules` em nenhum dos dois repositórios, e o contrato não o compara.

O comando `npm run check:firebase-contract` compara os repositórios locais. No CI, o workflow baixa o repositório irmão e bloqueia deploy quando existe drift.

## Responsabilidades

XTrainer:

- cadastra usuários comuns;
- mantém perfil e todos os dados privados do owner;
- cria treinos e executa sessões, incluindo troca de exercício (temporária ou definitiva) e pular exercício apenas na sessão do dia;
- mantém as alternativas de troca preferidas do próprio usuário (`exerciseSubstitutionPreferences`), sem tocar no catálogo global;
- registra evolução corporal;
- deriva analytics de sessões concluídas, incluindo resumos mensais/anuais.

XTrainer Admin:

- autentica apenas o UID configurado;
- lista identificação mínima de contas;
- cria, edita, ativa/desativa, importa e exporta exercícios;
- grava audit logs;
- não consulta dados privados do usuário, incluindo `exerciseSubstitutionPreferences`.

Firebase/ambiente confiável:

- provisiona `system/config`;
- lista/remove contas de Authentication quando necessário;
- recebe qualquer futura operação com Admin SDK;
- aplica App Check e políticas operacionais.

## Invariantes de segurança

1. `system/config` nunca é gravado pelo navegador.
2. Novo usuário sempre começa como `role: user`.
3. Admin é `request.auth.uid == system/config.adminUid`.
4. `ownerId` não pode mudar.
5. Admin não lê/grava workouts, sessions, weights, assessments ou exerciseSubstitutionPreferences.
6. Coleção não declarada é negada.
7. Audit log é imutável.
8. Sessão ativa só pode usar `active-{uid}`.
9. Sessão histórica nunca volta a ativa.
10. Histórico representa o que realmente aconteceu: uma série `completed` nunca é reatribuída a outro exercício por causa de uma troca posterior, e nunca é apagada por causa de um "pular hoje" (ver seção Contrato de sessão e analytics).

## Contrato de catálogo

- 202 exercícios canônicos;
- ID, nome normalizado e `sortOrder` únicos;
- `sortOrder` cobre 1–202;
- URLs atuais são HTTPS;
- IDs históricos nunca são alterados;
- seed usa merge e preserva `active` existente;
- links de pesquisa de vídeo legados recebem aviso, não são silenciosamente substituídos por links falsos.

## Contrato de sessão e analytics

- somente uma sessão ativa por UID;
- início/finalização/cancelamento são transacionais;
- inputs alteram estado local e sincronizam em eventos relevantes, não a cada tecla;
- descanso usa `restEndsAt`, não contador volátil;
- volume = soma de carga × repetições em sets concluídos;
- analytics usa somente sessões concluídas e agrupa pela identidade real de cada série (`TrainingSet.actualExerciseId ?? SessionExercise.exerciseId`), nunca apenas pelo exercício que estava planejado na ficha — uma troca no meio da execução pode deixar duas identidades dentro do mesmo `SessionExercise`, e cada série concluída antes da troca preserva a identidade que realmente executou;
- séries `skipped` (pular hoje) nunca entram em volume, séries efetivas ou recordes; séries já `completed` nunca são apagadas ou marcadas skipped;
- nome normalizado só é fallback para snapshots legados sem ID;
- recordes não são gravados manualmente em coleção paralela — nem os de sessão finalizada, nem a timeline usada em resumos mensais/anuais.

## Evolução de schema

Ao adicionar campo:

1. prefira opcionalidade;
2. atualize types nos dois projetos;
3. atualize DTOs e normalizadores;
4. atualize Rules/índices quando necessário;
5. crie teste de documento antigo e caso negativo de Rules;
6. execute o verificador de contrato;
7. documente em `FIRESTORE_SCHEMA.md`.

Migrações destrutivas exigem script separado, backup e plano de rollback. Readers devem ser liberados antes de writers que dependam do campo novo.

## Publicação

GitHub Pages e Firebase têm ciclos diferentes. Um build/deploy do frontend não aplica Rules/índices/Storage. A ordem segura é:

1. validar os dois projetos;
2. revisar diff do contrato;
3. publicar Rules/índices manualmente no projeto correto;
4. acompanhar Console/Logs;
5. publicar os PWAs;
6. fazer smoke test de usuário e admin.

Comando local de comparação:

```bash
npm run check:firebase-contract
```

Comando de publicação, somente após revisão:

```bash
firebase deploy --only firestore:rules,firestore:indexes --project xtrainer-45f8d
```
