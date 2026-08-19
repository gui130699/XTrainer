# XTrainer

PWA pessoal para criar treinos, executar séries, consultar histórico e acompanhar peso, medidas, avaliações físicas e evolução por exercício. O catálogo global de exercícios é mantido no projeto separado [XTrainer Admin](https://github.com/gui130699/XTrainer-Admin).

## Funcionalidades

- autenticação, cadastro de usuário e recuperação de senha;
- perfil com nome, altura, objetivo, nascimento, sexo, foto e troca segura de senha;
- criação, edição, duplicação, arquivamento, restauração e exclusão de treinos;
- uma única sessão ativa por usuário, retomada após recarregar e cancelamento explícito;
- séries com carga, repetições, volume, RPE/RIR compatíveis e descanso persistente;
- dashboard mensal com treinos, séries, volume, sequência semanal e recordes reais;
- histórico paginado somente de sessões concluídas, filtros e detalhamento de séries;
- evolução de peso, avaliações rápidas/completas/avançadas, medidas, dobras e fotos opcionais;
- progressão por exercício derivada exclusivamente das séries concluídas;
- instalação PWA em plataformas compatíveis e instrução específica para iOS.

## Stack

Next.js 16, React 19, TypeScript strict, Firebase Authentication, Cloud Firestore, Firebase Storage, Recharts, date-fns e Lucide.

## Desenvolvimento

```bash
npm install
npm run dev
```

Crie `.env.local` a partir de `.env.example`. As variáveis públicas necessárias são:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_BASE_PATH
```

As chaves web do Firebase identificam o projeto, mas não substituem Security Rules. Nunca coloque Service Account ou Admin SDK no frontend.

## Validação

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:rules
npm test
npm run check:firebase-contract
npm run build
```

`test:rules` requer Java 21 e usa o Firestore Emulator. `check:firebase-contract` compara Rules, indexes, Storage Rules, types e dataset com o repositório irmão.

## Administração segura

Não existe bootstrap público de administrador. O documento `system/config` deve ser provisionado manualmente, pelo Console Firebase ou por ambiente confiável:

```text
documento: system/config
initialized: true
adminUid: UID_DA_CONTA_ADMINISTRADORA
updatedAt: Timestamp opcional
```

O UID precisa existir no Firebase Authentication. Opcionalmente, o documento `users/{uid}` correspondente pode manter `role: "admin"` para exibição; a autorização efetiva usa exclusivamente `system/config.adminUid`.

O botão administrativo da tela de login abre `https://gui130699.github.io/XTrainer-Admin/`. A antiga rota interna `/admin` foi removida.

## Firebase e privacidade

Coleções:

- `system/config`: configuração pública somente para leitura; escrita bloqueada no cliente;
- `users`: perfil do próprio usuário; o administrador pode listar identificação das contas;
- `exercises`: catálogo global lido por autenticados e escrito somente pelo admin;
- `workouts`: treinos privados do owner;
- `workoutSessions`: sessões privadas do owner;
- `bodyWeights`: pesagens privadas do owner;
- `physicalAssessments`: avaliações, medidas e referências de fotos privadas do owner;
- `auditLogs`: logs administrativos imutáveis.

O administrador não recebe acesso a treinos, sessões, pesos, avaliações ou arquivos corporais. Não existe coleção `personalRecords`: recordes são sempre recalculados de sessões concluídas.

Consulte `FIRESTORE_SCHEMA.md` e `CONTRATO_COMPARTILHADO.md`.

## Publicação

O workflow de GitHub Pages executa lint, typecheck, testes, verificação do contrato e build antes de publicar `out/`. Configure os seis secrets Firebase no repositório e autorize `gui130699.github.io` em Authentication > Settings > Authorized domains.

O deploy do Pages não publica a configuração do Firebase. Depois de validar o projeto correto, publique manualmente:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project xtrainer-45f8d
```

Revise o diff e confirme o projeto antes desse comando. Ative Storage antes das fotos e configure App Check separadamente no Console, começando em modo de monitoramento.

## PWA

O cache deste aplicativo usa o prefixo `xtrainer-user-`; o Admin usa `xtrainer-admin-`. Um service worker nunca remove caches do outro. O botão de instalação só aparece quando o navegador oferece instalação ou quando o dispositivo iOS precisa da orientação de instalação manual.

O PWA de usuário usa a identidade visual azul do X com halteres no ícone instalado, favicon, tela de login, barra lateral desktop e cabeçalho mobile. O manifesto oferece versões `192x192`, `512x512` e uma variante `maskable` com margem segura para launchers adaptativos.

## Métodos de treino dinâmicos

O construtor carrega o catálogo global criado no XTrainer Admin, grava snapshots versionados e executa 14 motores seguros para séries normais, grupos, drop-set, rest-pause, cluster, progressões, top/back-off, cadência, falha, AMRAP, isometria, parciais, myo-reps e tempo. Consulte [RELATORIO_IMPLEMENTACAO_METODOS.md](RELATORIO_IMPLEMENTACAO_METODOS.md).
