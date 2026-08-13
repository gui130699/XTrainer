# Pendências e Melhorias do XTrainer

## Concluídas em 13/08/2026

- **P-001 — Build mascara problemas de qualidade:** concluída. `ignoreBuildErrors` e `ignoreDuringBuilds` foram removidos; lint, TypeScript e build foram executados sem erro.
- **P-002 — Sessão ativa não recuperável:** concluída. `sessions.getActive` localiza a sessão ativa; `/treino` oferece retomar ou descartar e persiste alterações de carga, repetições, séries e conclusão.
- **P-003 — Controle de peso incompleto:** concluída. `/evolucao` possui registro, validação de número brasileiro, edição, exclusão confirmada, cards, gráfico e histórico.
- **P-004 — Montagem/CRUD de treinos incompleto:** concluída. O builder suporta vários exercícios, prevenção de duplicidade, configuração individual, reordenação, edição, duplicação, arquivamento e exclusão sem apagar sessões.

## Críticas

### P-001 — Build mascara problemas de qualidade

- **Módulo:** Build/qualidade
- **Problema:** `ignoreBuildErrors` e `ignoreDuringBuilds` permitem publicar com erros de tipo/lint.
- **Situação atual:** ambos estão em `next.config.ts`.
- **Solução proposta:** corrigir tipos/lint existentes e remover as duas exceções.
- **Arquivos envolvidos:** `next.config.ts`, todo `src/`.
- **Prioridade:** Crítica | **Complexidade:** Média | **Dependências:** suíte lint/build limpa.

### P-002 — Sessão ativa não é recuperável na interface

- **Módulo:** Execução de treino
- **Problema:** sessão ativa é salva, mas recarregar/navegar perde o estado React e não há retomada.
- **Situação atual:** cria documento `status:"active"`, porém `/treino` só lista workouts.
- **Solução proposta:** localizar sessão ativa por ownerId, apresentar “Retomar treino” e persistir cada alteração de série.
- **Arquivos envolvidos:** `src/app/treino/page.tsx`, `src/services/data.ts`, índices.
- **Prioridade:** Crítica | **Complexidade:** Média | **Dependências:** query de sessão ativa.

## Alta prioridade

### P-003 — Controle de peso incompleto para usuário comum

- **Módulo:** Evolução/peso
- **Problema:** service e gráfico existem, mas cadastro está somente no admin; editar inexiste e excluir não tem UI.
- **Situação atual:** `weights.save/remove` e `bodyWeights` existem; `/evolucao` é somente leitura.
- **Solução proposta:** formulário usuário, histórico, validação, editar/remover com confirmação e atualização do gráfico.
- **Arquivos envolvidos:** `src/app/evolucao/page.tsx`, `src/services/data.ts`, `src/types/index.ts`.
- **Prioridade:** Alta | **Complexidade:** Média | **Dependências:** updateWeight no service.

### P-004 — Montagem/CRUD de treinos incompleto

- **Módulo:** Treinos
- **Problema:** um treino só aceita um exercício e não pode ser editado/excluído/reordenado.
- **Situação atual:** há pesquisa de biblioteca e `workouts.save`, mas nenhuma gestão posterior.
- **Solução proposta:** builder de lista com adicionar/remover/trocar/reordenar e tela de edição/exclusão confirmada.
- **Arquivos envolvidos:** `src/app/treino/page.tsx`, `src/services/data.ts`, `src/types/index.ts`.
- **Prioridade:** Alta | **Complexidade:** Alta | **Dependências:** UX mobile para lista de exercícios.

### P-005 — Histórico não expõe detalhes da sessão

- **Módulo:** Histórico
- **Problema:** snapshots de exercícios/sets existem, mas usuário vê apenas resumo.
- **Situação atual:** `sessions.get` não é chamado por `/historico`.
- **Solução proposta:** detalhe de sessão, data/hora/duração, exercícios, sets, cargas e observações.
- **Arquivos envolvidos:** `src/app/historico/page.tsx`, `src/services/data.ts`.
- **Prioridade:** Alta | **Complexidade:** Média | **Dependências:** UI de detalhe.

### P-006 — Validações e erros de formulários insuficientes

- **Módulo:** Formulários
- **Problema:** número de peso/carga e treino possuem mínimos limitados; saves em perfil/treino/peso não apresentam erro.
- **Situação atual:** HTML `required` predominante; bibliotecas Zod/RHF não são usadas.
- **Solução proposta:** schemas, limites, números decimais BR e mensagens por operação.
- **Arquivos envolvidos:** páginas de perfil, treino, evolução/admin; `package.json`.
- **Prioridade:** Alta | **Complexidade:** Média | **Dependências:** padronização de feedback.

## Média prioridade

### P-007 — Biblioteca sem CRUD manual visível

- **Módulo:** Administração/biblioteca
- **Problema:** `exercises.save/remove` existem, mas painel apenas importa/lista.
- **Solução proposta:** criar/editar/desativar/excluir com confirmação, preservando o seed idempotente.
- **Arquivos envolvidos:** `src/app/admin/page.tsx`, `src/services/data.ts`.
- **Prioridade:** Média | **Complexidade:** Média | **Dependências:** modais/feedback.

### P-008 — Avaliações físicas e recordes não disponíveis

- **Módulo:** Evolução
- **Problema:** assessments têm type/service; recordes nem service/cálculo têm.
- **Solução proposta:** priorizar avaliações CRUD; depois derivar PRs das sessões.
- **Arquivos envolvidos:** novas rotas/componentes, `src/services/data.ts`, types/rules.
- **Prioridade:** Média | **Complexidade:** Alta | **Dependências:** P-005.

### P-009 — Dashboard usa métricas incompletas

- **Módulo:** Dashboard
- **Problema:** sequência é quantidade total; recordes e desempenho mensal são placeholders.
- **Solução proposta:** cálculos baseados em sessões e remover/promover placeholders conforme dados.
- **Arquivos envolvidos:** `src/app/page.tsx`, serviços analíticos.
- **Prioridade:** Média | **Complexidade:** Média | **Dependências:** histórico detalhado/PRs.

### P-010 — Timer e offline sem experiência completa

- **Módulo:** Execução/PWA
- **Problema:** timer não possui alerta/pausa/persistência; SW não precacheia app inteiro nem há indicador de sincronização.
- **Solução proposta:** estado persistente, vibração/áudio opcional, atualização PWA e UX offline.
- **Arquivos envolvidos:** `src/app/treino/page.tsx`, `public/sw.js`, providers.
- **Prioridade:** Média | **Complexidade:** Alta | **Dependências:** P-002.

## Baixa prioridade

### P-011 — Perfil ampliado

- **Módulo:** Perfil
- **Problema:** sem foto, sexo, nascimento, e-mail/senha e sincronização de displayName depois da edição.
- **Solução proposta:** fluxos explícitos Auth/Storage e perfil corporal.
- **Arquivos envolvidos:** `src/app/perfil/page.tsx`, auth, Storage.
- **Prioridade:** Baixa | **Complexidade:** Média | **Dependências:** ativar Storage.

### P-012 — Qualidade de código e encoding

- **Módulo:** Manutenção
- **Problema:** arquivos compactados e texto com mojibake em fontes dificultam revisão e UX.
- **Solução proposta:** formatar, garantir UTF-8 e separar componentes.
- **Arquivos envolvidos:** diversas páginas e utils.
- **Prioridade:** Baixa | **Complexidade:** Média | **Dependências:** P-001.

## Melhorias futuras

- Meta de peso, IMC, medidas, fotos e comparação corporal.
- Exportação/backup, duplicação de treino e calendário.
- Histórico por exercício e progressão de carga.
- Gestão de usuários e limpeza segura de dados órfãos para administrador.
