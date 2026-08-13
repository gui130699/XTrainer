# XTrainer — Auditoria técnica e funcional

> Atualização de implementação — 13/08/2026: a criação de treino agora aceita vários exercícios, com configuração individual, ordem, edição, duplicação, arquivamento e exclusão. A rota de evolução permite registrar, editar e excluir peso, com gráfico e histórico. Sessões ativas são recuperadas ao abrir a tela de treino. O build não utiliza mais exceções para ignorar TypeScript ou ESLint.

> Fonte da verdade: código do repositório auditado em 13/08/2026. Esta documentação não trata tipos, collections ou services isolados como recursos completos.

## Índice

1. [Resumo executivo](#resumo-executivo)
2. [Arquitetura e stack](#arquitetura-e-stack)
3. [Rotas e módulos](#rotas-e-módulos)
4. [Autenticação e usuários](#autenticação-e-usuários)
5. [Treinos e execução](#treinos-e-execução)
6. [Biblioteca](#biblioteca-de-exercícios)
7. [Evolução, peso e histórico](#evolução-peso-e-histórico)
8. [Perfil, administração e estruturas não expostas](#perfil-administração-e-estruturas-não-expostas)
9. [Firebase, segurança e dados](#firebase-segurança-e-dados)
10. [PWA, offline e deploy](#pwa-offline-e-deploy)
11. [Matrizes](#matriz-funcional)
12. [Gaps, roadmap e score](#gaps-roadmap-e-score)
13. [Manuais](#manual-do-usuário)

## Resumo executivo

O XTrainer é uma aplicação estática Next.js hospedada no GitHub Pages, com Firebase no navegador. Autenticação, perfis, biblioteca global e o fluxo básico de criar/executar uma sessão funcionam conceitualmente ponta a ponta. A biblioteca padrão possui 202 registros em código e depende de importação explícita por administrador para entrar no Firestore.

O projeto ainda é um MVP: criação de treino só grava **um** exercício; não há edição/exclusão de treino, detalhes de sessões antigas, lançamento de peso acessível a usuários comuns, avaliações, recordes, fotos ou analytics prometidos. Há risco técnico relevante porque o build ignora erros de TypeScript/ESLint.

Principais módulos completos: autenticação básica, sessão, dashboard básico, busca na biblioteca e deploy. Principais módulos incompletos: peso, CRUD de treino, histórico detalhado, progresso por exercício, avaliação corporal e recordes.

## Arquitetura e stack

- Next.js 15 App Router com `output: "export"`; React 19 e TypeScript.
- Firebase Auth, Firestore e Storage inicializados em `src/lib/firebase.ts`.
- Persistência offline Firestore: `persistentLocalCache` com `persistentMultipleTabManager`; há fallback para `getFirestore`.
- Serviços concentrados em `src/services/auth.ts` e `src/services/data.ts`.
- Componentes: `AppShell`, `Guard`, `Providers`, `Button`, `Card`, `Empty`, `Loading`.
- Recharts é usado em um gráfico de peso. Lucide fornece ícones.
- Dependências instaladas porém sem uso encontrado: React Hook Form, Zod e `@hookform/resolvers`.

## Estrutura relevante

```text
src/app/              rotas e páginas
src/components/       shell, autenticação e UI base
src/data/             dataset dos 202 exercícios
src/lib/              Firebase e normalização
src/services/         Auth e Firestore
src/types/            contratos
public/               manifesto, ícone e service worker
.github/workflows/    deploy Pages
```

## Rotas e módulos

| Rota | Objetivo / acesso | Services / banco | Status e problemas |
|---|---|---|---|
| `/login` | login, cadastro, reset, primeiro admin e login admin | Auth; `users`, `system/config` | ⚠️ Implementado com problemas: fluxo funciona, mas `getSystemConfig` falhar faz botão de primeiro admin aparecer; regra impede criação posterior. Reset usa `prompt`, sem feedback de erro tratado. |
| `/` | dashboard autenticado | `sessions`, `workouts`, `weights` | 🟡 Parcial: mostra próximo treino, mês, volume, peso e sessões; “recordes recentes” é estado vazio fixo e sequência é total de sessões, não streak. |
| `/treino` | criar treino e executar sessão | `exercises`, `workouts`, `sessions` | 🟡 Parcial: cria treino com apenas um exercício; execução básica existe. Sem editar/excluir/reordenar/múltiplos exercícios. |
| `/evolucao` | peso e gráfico | `weights`, `bodyWeights` | 🟡 Parcial: leitura e gráfico reais; não há formulário, edição, exclusão ou histórico de lançamentos para usuário comum. |
| `/historico` | lista de sessões concluídas | `sessions`, `workoutSessions` | 🟡 Parcial: lista treino/data/séries/volume; não abre detalhes, não pesquisa, filtra, edita ou exclui. |
| `/perfil` | perfil e logout | `updateProfile`, `users` | 🟡 Parcial: edita nome, altura, objetivo; não edita Auth displayName/e-mail/senha/foto/sexo/nascimento. |
| `/admin` | biblioteca global | `exercises`, `exercises` | 🟡 Parcial: importa/lista/filtra/vê vídeo; UI atual não possui cadastro manual, edição, exclusão ou ativo/inativo, embora service tenha save/remove. |

## Autenticação e usuários

`Providers` usa `onAuthStateChanged`; todas as rotas internas usam `Guard`. Para admin, `Guard` exige `profile.role === "admin"`. O perfil é lido de `users/{uid}`; se a leitura falhar, a sessão continua com `profile:null`, o que bloqueia admin e pode renderizar campos vazios.

Fluxos encontrados:

- Login e senha: `signInWithEmailAndPassword`; mensagens amigáveis para códigos selecionados.
- Cadastro comum: Auth + documento user com `role:"user"` + `displayName` Auth.
- Primeiro admin: transação em `system/config`; pode promover uma conta existente se a senha for conhecida. A regra impede segunda inicialização após config existir.
- Admin login: autentica e compara UID a `system/config.adminUid`, depois navega a `/admin`.
- Logout: `signOut`; não há redirecionamento explícito, mas Guard redireciona.
- Reset: envia e-mail, mas falhas da chamada não são exibidas.

### Campos de `users/{uid}` realmente usados

| Campo | Tipo | Criado/alterado | Exibido/uso |
|---|---|---|---|
| `uid` | string | cadastro/admin | identificação e regras |
| `name` | string | cadastro; perfil; promoção admin | saudação e perfil |
| `email` | string | cadastro | perfil |
| `role` | `admin`/`user` | cadastro/admin | Guard e link Administração |
| `height` | number opcional | Perfil | somente formulário; não há cálculo |
| `goal` | string opcional | Perfil | somente formulário |
| `birthDate`, `sex`, `photoURL` | opcionais no type | nenhuma UI encontrada | 🔵 estrutura preparada |
| `createdAt` | Timestamp | cadastro | não exibido |

## Treinos e execução

### Criação

Usuário abre `/treino`, clica **Novo treino**, pesquisa a biblioteca localmente e seleciona um item. O formulário exige nome/título e grava `workouts/{autoId}` com `ownerId`, um único `WorkoutExercise`, séries, faixa de repetições e descanso. A ação “+ Adicionar” apenas seleciona o exercício; não acrescenta outro à lista.

Status: 🟡 Parcialmente implementado. Não há edição, remoção, duplicação, desativação via UI, observação por exercício ou reordenação. `workouts.save(id)` existe, porém não há tela que a chame para update. Não existe delete no service.

### Execução

Iniciar cria `workoutSessions/{autoId}` com snapshot dos exercícios e sets planejados, `startedAt:serverTimestamp()`, status ativo, total de volume/sets. Concluir set altera o estado local, calcula `load * reps`, acumula volume/séries e salva a sessão. É possível adicionar série extra no estado da sessão; ela só persiste quando alguma série é concluída ou quando finalizar salva a sessão.

O timer inicia após concluir uma série, tem pular e +15s; não possui pausa, som, vibração, notificação, persistência ou execução confiável fora da página. Finalizar grava status, `endedAt` e duração sem confirmação, não apresenta resumo nem redireciona. Não há cancelar, desfazer conclusão, remoção de série ou navegar por exercício. Sessão ativa é persistida, mas não há mecanismo de retomar após recarregar; o usuário apenas vê a sessão se o app mantiver o estado em memória.

### Volume e histórico de exercício

Fórmula real: por set concluído, `volume = load * reps`; `totalVolume` soma o volume concluído. Não há melhor carga, última execução, recorde, progressão, RPE/RIR ou histórico por exercício na UI.

## Biblioteca de exercícios

`src/data/default-exercises.ts` gera `DEFAULT_EXERCISES` a partir de 202 itens. IDs são slugs determinísticos, os campos incluem `name`, `nameEn`, `aliases` (somente para uma parcela), `muscleGroup`, `videoUrl`, `active` e `sortOrder`. A validação no seed exige 202, IDs/ordens/nomes normalizados únicos, ordens 1–202 e URL HTTPS.

Admin importa manualmente por batches de 400 usando `set(..., {merge:true})`; documentos com mesmos IDs são atualizados e personalizados com outros IDs não são apagados. Estatística `skipped` sempre retorna 0; não há migração semântica de registros antigos com IDs diferentes. A segurança é efetuada pelas regras (`write` de exercises somente admin), não há verificação de papel dentro de `seedDefaultLibrary` além dessa proteção do Firestore.

Painel admin tem busca local, normalização sem acento, inglês/aliases, grupo, A-Z/Z-A/ordem e links externos seguros. Usuários na montagem de treino também pesquisam e filtram localmente e podem abrir vídeo. Cadastro/edição/exclusão manual e ativo/inativo não estão expostos apesar de `save/remove` existirem.

## Evolução, peso e histórico

### Peso corporal — status: 🟡 Parcialmente implementado

`BodyWeight` tem `ownerId`, `date`, `weight`, `note`, `createdAt`. `weights.list/save/remove` existem. A única interface de `weights.save` está dentro de `/admin`, inacessível ao usuário comum e sem listagem, edição ou exclusão. `/evolucao` lê por `date ASC`, mostra último array como peso atual, primeiro como inicial, variação total e gráfico Recharts real. Sem registros, mostra estado vazio.

Validações: formulário admin usa `type=number`, required e `step=0.1`, mas não estabelece mínimo/máximo; aceita 0, negativos e valores excessivos. Vírgula decimal depende do navegador e `Number()`. Não há update de peso no service. “Peso atual” é o último por **campo `date` lexicográfico**, não por `createdAt`.

### Histórico de treino — status: 🟡 Parcial

Consulta até 30 sessões por ownerId/startAt desc. Mostra apenas concluídas, nome, dia/mês, séries e volume. O snapshot completo existe no documento, mas não é acessível por UI. Não há detalhes, paginação, filtros, busca, edição ou exclusão.

### Avaliações e recordes — status: 🔵 Estrutura preparada

`PhysicalAssessment` e `assessments.list/save` existem, mas não há rota, menu ou formulário. `PersonalRecord` é citado somente na estrutura inicial; não existe type, service, coleção usada nem cálculo. Não há foto, medidas, IMC, meta de peso ou comparação.

## Perfil, administração e estruturas não expostas

Perfil permite salvar nome/altura/objetivo em Firestore. Não atualiza `displayName` após edição, logo dashboard pode manter fallback inconsistente se profile falhar. Não há atualização de e-mail/senha/foto. Admin só administra biblioteca; não há usuários, dados, backup ou configurações administrativas.

Funcionalidades no código inacessíveis na UI: `weights.remove`, `assessments.list/save`, `exercises.save/remove`, `workouts.save` em modo update. Não há interfaces deliberadamente “falsas”; há card de recordes e desempenho mensal, mas são mensagens estáticas de futuro, não dados calculados.

## Firebase, segurança e dados

Veja [FIRESTORE_SCHEMA.md](./FIRESTORE_SCHEMA.md) para o mapa completo.

Riscos das regras:

- A regra genérica `match /{collection}/{id}` referencia `resource.data.ownerId` para leitura/escrita; para docs inexistentes em update e collections sem ownerId o resultado é deny, mas é pouco explícita e pode dificultar manutenção.
- `workouts` permite update próprio desde que `request.resource.data.ownerId == resource.data.ownerId`, corretamente impedindo troca de dono. Reads admin ou dono são adequados.
- `system/config` é leitura pública para decidir primeiro admin; expõe somente config, não dados privados.
- Storage só permite `/users/{uid}/**` ao mesmo UID, mas nenhum upload/uso de Storage existe. O bucket ainda pode precisar ser inicializado no Firebase Console.
- Web config Firebase no bundle não é segredo por si; proteção depende de Rules e Auth. Não há service account ou chave privada no repositório.

Risco de dados órfãos: não há exclusão de usuário nem cascade delete; se uma conta Auth for removida externamente, workouts/sessions/pesos podem permanecer sem dono operacional.

## PWA, offline e deploy

Manifest: nome XTrainer, standalone, cores e um SVG. `start_url:"/"` não considera explicitamente `/XTrainer/`; com Pages pode depender do contexto do navegador. O SW v2 cacheia `./`, manifest e ícone no install; em fetch usa cache-first e tenta cachear todas as respostas GET. Limpa caches antigos na ativação. Não há UI de atualização, fallback offline dedicado, precache de chunks nem versionamento automatizado.

Firestore solicita cache persistente local e múltiplas abas, portanto leituras/gravações Firestore podem usufruir fila offline do SDK quando suportado. Isso é distinto do SW. Login offline não é garantido; a biblioteca/treinos não são pré-carregados explicitamente, e não há status “sincronizando”.

GitHub Actions: push `main` ou manual → Node 22 → `npm ci` → `npm run build` → artifact `out` → Pages. `basePath`/`assetPrefix` são aplicados apenas em GitHub Actions. O workflow tem variáveis Firebase por secrets, mas o app também possui defaults públicos no código.

## Matriz funcional

| Módulo | Funcionalidade | UI | Service | Banco | Status | Observação |
|---|---|---:|---:|---:|---|---|
| Auth | Login/logout/cadastro | Sim | Sim | Auth/users | ✅ | logout depende do Guard para redirecionar |
| Auth | Primeiro admin | Sim | Sim | system/users | ⚠️ | UI pode aparecer em falha de leitura; Rules barram segunda criação |
| Biblioteca | Importar 202 | Sim admin | Sim | exercises | ✅ | execução manual; não foi possível confirmar importação real nesta auditoria |
| Biblioteca | Busca/filtro/vídeo | Sim | lista | exercises | ✅ | local após leitura |
| Biblioteca | CRUD manual | Não completo | save/remove parcial | exercises | 🟡 | sem UI admin para create/edit/remove |
| Treino | Criar um treino de um exercício | Sim | Sim | workouts | ✅ | validação limitada |
| Treino | Múltiplos/editar/remover/reordenar | Não | update parcial | workouts | 🔴 | fluxo ausente |
| Sessão | Registrar set e volume | Sim | Sim | workoutSessions | ✅ | cálculo carga×reps |
| Sessão | Timer básico | Sim | estado local | — | 🟡 | sem pausa/alerta/persistência |
| Histórico | Lista compacta | Sim | Sim | workoutSessions | ✅ | limitada a 30 sessões |
| Histórico | Detalhe/CRUD/filtros | Não | get parcial | workoutSessions | 🔴 | snapshot não exposto |
| Peso | Gráfico/leitura | Sim | Sim | bodyWeights | ✅ | dados reais por date |
| Peso | Cadastrar para usuário | Não | Sim | bodyWeights | 🟡 | só admin possui formulário |
| Peso | Editar/excluir/listar | Não | remove só | bodyWeights | 🔴 | update inexiste |
| Avaliações | CRUD/UI | Não | list/save | physicalAssessments | 🔵 | estrutura não acessível |
| Recordes | cálculo/UI | Não | Não | — | 🔴 | card é placeholder |
| Perfil | nome/altura/objetivo | Sim | Sim | users | ✅ | sem feedback de erro |
| Perfil | foto/e-mail/senha/sexo/nascimento | Não | Não | users/Auth | 🔴 | campos tipo sem fluxo |

## Matriz CRUD

| Entidade | Create | Read | Update | Delete | Interface completa? |
|---|---|---|---|---|---|
| Users | cadastro | provider/perfil | perfil parcial | não | Não |
| Exercises | import; service manual | admin/treino | seed/service | service | Não |
| Workouts | um exercício | lista | service sem UI | não | Não |
| WorkoutSessions | iniciar | lista/get | set/finalizar | não | Não |
| BodyWeights | admin somente | dashboard/evolução | não | service sem UI | Não |
| PhysicalAssessments | service | service | não | não | Não |
| PersonalRecords | não | não | não | não | Não |

## Gaps, roadmap e score

Veja [PENDENCIAS_E_MELHORIAS.md](./PENDENCIAS_E_MELHORIAS.md) para prioridades e plano. Próxima implementação recomendada: **controle de peso completo para usuários**, pois dados/consulta/gráfico já existem mas o usuário comum não consegue criar ou corrigir o dado que alimenta o módulo.

| Área | Nota | Justificativa |
|---|---:|---|
| Autenticação | 6/10 | fluxos presentes, mas alguns erros e estados são frágeis |
| Treinos | 4/10 | criação mínima sem CRUD ou múltiplos exercícios |
| Execução | 5/10 | sets/volume/timer básico; sem recuperação e feedback final |
| Histórico | 3/10 | somente lista resumida |
| Evolução | 3/10 | gráfico real, entrada de dados inacessível ao usuário |
| Perfil | 4/10 | três campos persistidos |
| Biblioteca | 7/10 | dataset, seed, busca e filtros sólidos; CRUD manual ausente |
| Administração | 4/10 | apenas biblioteca |
| Segurança | 6/10 | Rules razoáveis; regra genérica e validação client-side são riscos |
| PWA/offline | 4/10 | SW e cache Firestore, sem experiência offline completa |
| UX mobile | 5/10 | layout responsivo básico; fluxos longos e feedback limitado |
| Qualidade de código | 4/10 | arquivos densos, encoding inconsistente e build ignora verificações |

## Manual do usuário

1. No primeiro acesso, crie uma conta. Caso seja a primeira configuração do sistema, use **Primeiro acesso: Criar administrador**.
2. Entre normalmente; o Dashboard mostra cards de sessões, volume e peso quando existirem dados.
3. Em **Treino**, clique em **Novo treino**, filtre a biblioteca, selecione um exercício, informe título/séries/repetições/descanso e crie. Atualmente cada novo treino aceita um exercício.
4. Inicie o treino, informe carga e repetições, conclua séries e use o cronômetro. Finalize para gravar a sessão.
5. Em **Histórico**, consulte as sessões concluídas em forma resumida.
6. Em **Evolução**, consulte o gráfico de peso; atualmente não existe lançamento de peso na área comum do usuário.
7. Em **Perfil**, altere nome, altura e objetivo; use Sair para encerrar.

## Manual do administrador

Além das funções de usuário, o administrador pode abrir **Perfil → Administração**, importar/atualizar a biblioteca padrão e buscar, filtrar, ordenar e abrir vídeos dos exercícios. A tela atual não oferece CRUD manual de exercícios, administração de usuários, backup ou configurações gerais.

## Guia do desenvolvedor e testes

Arquivos de referência: UI/rotas em `src/app`, services em `src/services`, tipos em `src/types`, rules na raiz. Rodar `npm run lint` e `npm run build`. Durante a auditoria, o lint iniciou sem saída de erro no terminal e o build local ficou inconclusivo na janela de execução; o último deploy Pages anterior à auditoria informou build bem-sucedido. O build de produção **ignora** erros TypeScript (`ignoreBuildErrors`) e ESLint (`ignoreDuringBuilds`), portanto aprovação de build não prova qualidade de tipos/lint.
