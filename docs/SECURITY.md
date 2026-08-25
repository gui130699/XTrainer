# Modelo de segurança — XTrainer

Atualizado em 25/08/2026, como parte da auditoria de hardening (branch `security/hardening-v1`).
Cobre XTrainer e seu par administrativo, XTrainer-Admin, que compartilham o mesmo projeto
Firebase (`xtrainer-45f8d`) e o mesmo contrato de dados (`npm run check:firebase-contract`).

Este documento não contém segredos. Se algo aqui parecer um valor sensível, é porque é
intencionalmente público — ver a seção Secrets.

## Arquitetura

```
Internet
   │
   ▼
App Check (preparado, desligado até NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY existir)
   │
   ▼
Firebase Authentication (e-mail/senha)
   │
   ├── Usuário comum
   │      → Firestore Rules owner-only (ownerId == request.auth.uid)
   │      → dados privados: workouts, workoutSessions, bodyWeights,
   │        physicalAssessments, exerciseSubstitutionPreferences
   │
   └── Administrador (XTrainer-Admin)
          → autoridade hoje: system/config.adminUid == request.auth.uid
          → autoridade futura: request.auth.token.admin == true (custom claim)
          → catálogo global: exercises, muscleGroups, trainingMethods
          → NÃO lê dados privados de nenhum usuário
```

Hospedagem: GitHub Pages (export estático, `next build && next export` via `output: "export"`).
Isso significa que **não há servidor de aplicação** — toda a superfície de ataque de backend é o
Firestore em si, protegido só pelas Security Rules (não há Cloud Functions nem API própria).

## Modelo de autenticação

- Único provedor: e-mail/senha (Firebase Authentication).
- Cadastro cria `users/{uid}` com `role: "user"` sempre — o cliente nunca pode escolher `role`
  no create (Rules exigem `request.resource.data.role == 'user'`).
- `ensureUserProfile()` recria um perfil mínimo se uma conta existir no Authentication sem
  `users/{uid}` correspondente (perfil perdido/conta criada fora do fluxo normal) — sempre com
  `role: "user"`, nunca herda privilégio.
- Verificação de e-mail: **ainda não obrigatória**. Backlog: `sendEmailVerification()` no
  cadastro + bloqueio de acesso administrativo sem `email_verified == true` (ver
  SECURITY-CHECKLIST.md). Não ativar sem migrar contas existentes primeiro.
- Política de senha: mínimo 6 caracteres hoje (padrão Firebase). Backlog: política forte
  (mínimo 12, maiúscula/minúscula/número/especial) via Console + `validatePassword()` no
  frontend quando disponível na versão do SDK em uso.

## Modelo de autorização administrativa

Hoje: `isAdmin()` nas Rules verifica exclusivamente `system/config.adminUid == request.auth.uid`.
`users/{uid}.role` **nunca** é usada para decidir privilégio administrativo — só existe para
exibição, e um usuário não pode se autopromover escrevendo `role: "admin"` (bloqueado nas Rules
e coberto por teste adversarial).

Migração planejada para custom claims (`request.auth.token.admin == true`), preparada mas **não
ativada** nesta auditoria:

1. Identificar a conta admin atual (`system/config.adminUid`).
2. Rodar `npm run provision:admin-claim -- --uid=<uid> --yes` no XTrainer-Admin, localmente, com
   Application Default Credentials (nunca com uma chave de service account commitada).
3. A conta precisa sair e entrar de novo (ou `getIdToken(true)`) para o token carregar a claim.
4. Só depois disso, atualizar `isAdmin()` nas Rules para aceitar
   `request.auth.token.admin == true` **em adição** a `system/config.adminUid` (nunca substituir
   de uma vez só — ver Fase 16 do briefing original).

## Modelo de acesso ao Firestore

Deny-by-default: qualquer coleção não declarada em `firestore.rules` é negada para todos os
papéis (testado explicitamente). Toda coleção privada exige:

- `ownerId` obrigatório no create, imutável em qualquer update.
- Leitura/escrita restrita a `request.auth.uid == ownerId` (nunca ao admin).
- Validação de schema (`hasOnly`/`hasAll`) e, desde esta auditoria, limites de tamanho em campos
  de texto e listas (ver `firestore.rules`, funções `valid*`).

`tests/firestore.rules.test.mjs` cobre o caminho feliz e regressão funcional;
`tests/firestore.security-adversarial.test.mjs` cobre 60+ tentativas de ataque (IDOR,
escalonamento de privilégio, falsificação de ownerId/uid/role, abuso de tamanho, injeção de URL
no catálogo, coleções não declaradas). Rodar com `npm run test:rules`.

## Secrets

O que está no repositório e é **intencionalmente público**:

- `src/lib/firebase.ts`: apiKey/authDomain/projectId/appId do Firebase Web. Por design, todo
  app Firebase Web expõe esses valores no bundle entregue ao navegador — não são credenciais de
  servidor. A proteção real é o Firestore Rules (owner-only) e, quando ativado, App Check.
- `.env.example`: nomes de variável apenas, sem valores reais.

O que **nunca** deve entrar no repositório (bloqueado por `.gitignore` e pelo workflow de secret
scan/push protection do GitHub): chaves privadas, service account JSON, tokens de CI, senhas.
Varredura completa do histórico do repositório (`git log --all -G<padrão>`) não encontrou
nenhuma dessas categorias.

## App Check

Status: **preparado, não ativado** (`initializeAppCheck` só roda se
`NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` estiver definida). Próximos passos manuais no
Console Firebase: registrar reCAPTCHA Enterprise, habilitar App Check em modo **Monitor** para
Firestore, confirmar tráfego válido dos dois apps por alguns dias, só então considerar
enforcement.

## Dados locais / offline

- XTrainer (app do usuário): usa `persistentLocalCache` do Firestore para funcionar offline
  durante o treino — decisão de produto mantida. Dados privados (peso, avaliações, perfil) podem
  ficar em IndexedDB neste dispositivo; isso não é "criptografia ponta a ponta", é o
  comportamento padrão documentado do SDK. Ver Fase 38/39 do briefing original.
- Perfil → "Sair e limpar dados deste dispositivo": logout + `clearIndexedDbPersistence` +
  limpeza de `localStorage`/`sessionStorage`/Cache Storage. Nunca apaga dado remoto.
- XTrainer-Admin: usa `memoryLocalCache` (não persiste em disco) e
  `browserSessionPersistence` no Auth (sessão termina ao fechar a aba) — painel administrativo
  não precisa de uso offline, e dado consultado não deve sobreviver ao fechamento do navegador.
- Timeout de inatividade de 20 minutos no Admin, com aviso 2 minutos antes.

## Incident response

**Se um segredo real vazar** (ex.: alguém commitar uma service account por engano):

1. Revogar/desativar a credencial imediatamente no Google Cloud Console (IAM → Service Accounts,
   ou API Keys).
2. Rotacionar (gerar uma nova, nunca reaproveitar a comprometida).
3. Investigar logs do Cloud Audit Log para uso indevido no período de exposição.
4. Remover do código e, se necessário, do histórico do Git (`git filter-repo` ou equivalente,
   coordenado — reescrever histórico exige force-push e comunicação, ver Fase 9).
5. Redeploy depois de confirmar que o valor não aparece mais em nenhum commit.

**Se a conta administrativa for comprometida:**

1. No Console Firebase Authentication, desabilitar a conta ou revogar tokens de atualização
   (`revokeRefreshTokens`).
2. Trocar a senha.
3. Revisar `auditLogs` (append-only, `create = admin`) por ações suspeitas no período.
4. Se custom claims já estiverem em uso, revisar/remover a claim `admin` da conta antes de
   restaurar acesso.
5. Considerar trocar `system/config.adminUid` (só via Console/Admin SDK — o cliente nunca escreve
   nesse campo) se a própria identidade do admin precisar mudar.

## Deploy e rollback

GitHub Pages (deploy do frontend) e Firestore Rules/Indexes são **pipelines independentes** —
publicar o site não publica Rules. Depois de alterar `firestore.rules`/`firestore.indexes.json`:

```bash
firebase deploy --only firestore:rules,firestore:indexes --project xtrainer-45f8d
```

Reversão desta auditoria específica: a palavra `REVERTER_HARDENING_XTRAINER` reverte (via
`git revert`, nunca `reset --hard`) apenas os commits da branch `security/hardening-v1`,
preservando tudo commitado antes e depois.
