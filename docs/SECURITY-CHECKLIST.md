# Checklist de segurança — XTrainer / XTrainer-Admin

Estado em 25/08/2026, ao final da auditoria `security/hardening-v1`. `[x]` = verificado feito
nesta auditoria. `[ ]` = pendente, requer ação manual (Firebase Console, Google Cloud Console ou
GitHub Settings) ou uma decisão de produto que só o mantenedor pode tomar. Ver docs/SECURITY.md
para o "porquê" de cada item pendente.

## GitHub

- [x] Secret scanning habilitado (já estava, confirmado via API)
- [x] Push protection habilitado (já estava, confirmado via API)
- [x] Dependabot vulnerability alerts habilitado nesta auditoria
- [x] Dependabot security updates habilitado nesta auditoria
- [x] `.github/dependabot.yml` (npm + github-actions, semanal)
- [x] Branch protection mínima em `main` (bloqueia force-push e deleção) — habilitado nesta
      auditoria via API, sem exigir PR/review (preserva o fluxo atual de push direto)
- [ ] 2FA obrigatória na conta GitHub — verificar em Settings → Password and authentication
- [ ] Passkey como método preferencial de login
- [ ] Recovery codes gerados e guardados offline (nunca no repositório)
- [ ] Revisar sessões ativas e GitHub Apps/PATs autorizados periodicamente
- [ ] Decisão explícita sobre exigir Pull Request + review em `main` (hoje o fluxo é push
      direto; mudar isso é uma decisão de processo, não só técnica)

## CI/CD

- [x] Job de build/test separado do job de deploy, cada um com `permissions:` mínimas
      (`contents: read` no build; `pages: write` + `id-token: write` só no deploy)
- [x] `npm ci` (nunca `npm install`) em todos os workflows
- [x] `npm audit --omit=dev --audit-level=high` como etapa obrigatória do build
- [x] CodeQL (`javascript-typescript`) em push/PR/semanal
- [x] Gitleaks em push/PR
- [x] `check:firebase-contract` continua bloqueando deploy em caso de divergência entre os repos

## Secrets

- [x] Varredura do histórico completo do Git (`git log --all -G<padrão>`) por
      private_key/client_secret/BEGIN PRIVATE KEY/ghp_/github_pat_/AWS_SECRET/
      GOOGLE_APPLICATION_CREDENTIALS/FIREBASE_TOKEN/service_account — nenhuma ocorrência
- [x] Único `AIza...` no código é o Firebase Web API key público, documentado como
      PUBLIC CLIENT CONFIG (não segredo) em `src/lib/firebase.ts`
- [x] `.gitignore` endurecido (`.env`, `*.pem`, `*.key`, `service-account*.json`,
      `credentials*.json`, `*.secret` etc.)
- [x] `.env.example` criado/corrigido para conter só nomes de variável (Admin tinha valores
      reais preenchidos — corrigido; eram valores públicos, não um vazamento real)

## Firestore

- [x] Deny-by-default confirmado por teste (coleção não declarada nega para todos os papéis)
- [x] `tests/firestore.security-adversarial.test.mjs` — 51 testes, 60+ asserções adversariais
      (IDOR, ownerId/uid/role forjados, abuso de tamanho, injeção de URL, sessão ativa)
- [x] Limites de tamanho adicionados a todas as funções `valid*` (nomes, notas, listas)
- [x] `videoUrl` de exercício restrito a `https://` + domínio YouTube (Rules + client + form
      do Admin)
- [x] E-mail do perfil não é mais editável via update; create exige igualdade com
      `request.auth.token.email` quando o token carrega essa claim
- [ ] Publicar `firestore.rules`/`firestore.indexes.json` atualizados em produção — **rodar
      manualmente**: `firebase deploy --only firestore:rules,firestore:indexes --project
      xtrainer-45f8d` (ver seção MANUAL ACTIONS do relatório desta auditoria)

## Auth

- [ ] E-mail verificado obrigatório para acesso administrativo (`email_verified == true`) —
      não ativado; precisa de plano de migração para contas existentes primeiro
- [ ] Política de senha forte (mínimo 12 + complexidade) — configurar em Firebase Console →
      Authentication → Settings → Password policy
- [x] Script de provisionamento de custom claim `admin: true` criado
      (`scripts/provision-admin-claim.mjs`, XTrainer-Admin) — **não executado**; requer decisão
      e credenciais do mantenedor
- [ ] Rules atualizadas para aceitar a custom claim como autoridade admin (só depois da claim
      estar provisionada e verificada)
- [ ] MFA (TOTP) na conta administrativa — requer Identity Platform habilitado no projeto
      (verificar no Console se já está disponível no plano atual)

## App Check

- [x] Código de inicialização preparado (`initializeAppCheck`, `ReCaptchaEnterpriseProvider`),
      condicional a `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY`
- [ ] Registrar reCAPTCHA Enterprise no Google Cloud Console e obter a site key
- [ ] Habilitar App Check para Firestore no modo **Monitor** (nunca Enforced direto)
- [ ] Confirmar tráfego válido de XTrainer e XTrainer-Admin por alguns dias antes de considerar
      enforcement

## Local data / PWA

- [x] XTrainer-Admin migrado de `persistentLocalCache` para `memoryLocalCache`
- [x] XTrainer-Admin: `browserSessionPersistence` no Auth, aguardado antes do login
- [x] Timeout de inatividade de 20 min no Admin, com aviso 2 min antes
- [x] "Sair e limpar dados deste dispositivo" no XTrainer (Perfil)
- [x] `public/sw.js` auditado: só GET, mesma origem, cache versionado, remove cache antigo
      (nenhuma mudança necessária)

## Google Cloud / Firebase Console

- [ ] Revisar IAM: Owners/Editors/Service Accounts do projeto `xtrainer-45f8d`, aplicar
      least privilege
- [ ] Restringir a Firebase Web API key no Google Cloud Console (API restrictions/HTTP referrer)
      sem quebrar Authentication — testar antes de aplicar em produção
- [ ] Revisar domínios autorizados em Authentication → Settings (remover os que não são mais
      usados)
- [ ] Configurar alertas de billing/orçamento no Google Cloud
- [ ] Avaliar proteção contra enumeração de e-mail nos fluxos de cadastro/recuperação de senha

## Documentação

- [x] `docs/SECURITY.md` (este diretório)
- [x] `docs/SECURITY-CHECKLIST.md` (este arquivo)
