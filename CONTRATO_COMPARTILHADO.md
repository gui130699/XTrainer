# Contrato compartilhado XTrainer ↔ XTrainer Admin

## Fonte canônica e política

O Firebase é único (`xtrainer-45f8d`). O XTrainer Admin é a referência operacional para administração do catálogo, mas os seguintes arquivos devem permanecer byte a byte equivalentes, desconsiderando final de linha:

- `firestore.rules`;
- `firestore.indexes.json`;
- `storage.rules`;
- `src/types/index.ts`;
- `src/data/default-exercises.ts`.

O comando `npm run check:firebase-contract` compara os repositórios locais. No CI, o workflow baixa o repositório irmão e bloqueia deploy quando existe drift.

## Responsabilidades

XTrainer:

- cadastra usuários comuns;
- mantém perfil e todos os dados privados do owner;
- cria treinos e executa sessões;
- registra evolução corporal;
- deriva analytics de sessões concluídas.

XTrainer Admin:

- autentica apenas o UID configurado;
- lista identificação mínima de contas;
- cria, edita, ativa/desativa, importa e exporta exercícios;
- grava audit logs;
- não consulta dados privados do usuário.

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
5. Admin não lê/grava workouts, sessions, weights ou assessments.
6. Fotos só podem ser acessadas pelo UID dono.
7. Coleção não declarada é negada.
8. Audit log é imutável.
9. Sessão ativa só pode usar `active-{uid}`.
10. Sessão histórica nunca volta a ativa.

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
- analytics usa somente sessões concluídas e agrupa por `exerciseId`;
- nome normalizado só é fallback para snapshots legados sem ID;
- recordes não são gravados manualmente em coleção paralela.

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
3. publicar Rules/índices/Storage manualmente no projeto correto;
4. acompanhar Console/Logs;
5. publicar os PWAs;
6. fazer smoke test de usuário e admin.

Comando local de comparação:

```bash
npm run check:firebase-contract
```

Comando de publicação, somente após revisão:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project xtrainer-45f8d
```
