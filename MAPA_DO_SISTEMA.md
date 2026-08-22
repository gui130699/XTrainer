# Mapa do Sistema XTrainer

> Atualização 22/08/2026: troca de exercício com escopo, pular exercício, alternativas
> preferidas, feedback tátil/sonoro, tela sempre ativa e resumos (mensal/anual) foram
> adicionados; fotos e Firebase Storage foram removidos do projeto.

```text
Visitante
└── /login
    ├── Entrar
    ├── Cadastrar novo usuário
    ├── Recuperar senha
    └── Abrir painel administrativo (link externo para o XTrainer Admin)

Usuário autenticado
├── / Dashboard
│   ├── Data do dia (abre calendário do mês com dias treinados marcados)
│   ├── Próximo treino, cards de sessões/volume/peso, sequência semanal
│   ├── Últimas sessões e recordes recentes
│   └── Card "Seu mês" → /resumos?tab=mensal
├── /treino
│   ├── Montar treino: múltiplos exercícios, métodos dinâmicos, grupos (bi-set/tri-set/...)
│   └── Executar sessão:
│       ├── séries, cronômetro de descanso (som/vibração/notificação), tela sempre ativa
│       ├── trocar exercício (alternativas preferidas → biblioteca completa → só nesta
│       │   sessão ou definitivamente)
│       └── pular exercício apenas hoje, com motivo opcional e desfazer
├── /evolucao
│   └── Peso, avaliações físicas, medidas corporais e progresso por exercício
├── /historico
│   └── Sessões concluídas paginadas, com detalhe de série, substituições e exportação
│       CSV/PDF
├── /resumos
│   ├── ?tab=mensal&month=AAAA-MM — resumo do mês, comparado ao anterior
│   └── ?tab=anual&year=AAAA — XTrainer Wrapped, com compartilhamento
└── /perfil
    ├── Nome, altura, objetivo, sexo, nascimento, e-mail/senha
    ├── Tema claro/escuro
    ├── Logout
    └── /admin (link externo — o painel administrativo é o repositório XTrainer-Admin)

Dados (Firestore, projeto xtrainer-45f8d)
├── users/{uid}
├── system/config
├── exercises/{id} ──> workouts.exercises[].exerciseId
├── trainingMethods/{id} ──> workouts.exercises[].methodSnapshot
├── workouts/{id} ──> workoutSessions/{id} (snapshot por sessão)
├── workoutSessions/{id}
│   └── exercises[].sets[] — actualExerciseId/skipped carimbam a identidade real de cada
│       série após troca/pular, sem nunca reescrever o que já foi concluído
├── exerciseSubstitutionPreferences/{id} — alternativas de troca preferidas (privado)
├── bodyWeights/{id}
└── physicalAssessments/{id}

Não existe mais Firebase Storage: fotos de perfil e de avaliação foram removidas.
Resumos mensais/anuais são sempre derivados de workoutSessions em memória — não há
collection "monthlyStats"/"yearlyStats".
```
