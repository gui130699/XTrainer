# Mapa do Sistema XTrainer

> Atualização 13/08/2026: `/treino` inclui builder de múltiplos exercícios, CRUD e recuperação de sessão ativa; `/evolucao` inclui CRUD e histórico de peso.

```text
Visitante
└── /login
    ├── Entrar
    ├── Cadastrar novo usuário
    ├── Recuperar senha
    ├── Entrar como administrador
    └── Primeiro acesso: criar administrador (somente sem system/config)

Usuário autenticado
├── / Dashboard
│   ├── Próximo treino
│   ├── Cards de sessões/volume/peso
│   └── Últimas sessões
├── /treino
│   ├── Criar treino (um exercício)
│   └── Executar sessão, séries e timer
├── /evolucao
│   └── Gráfico e cards de peso
├── /historico
│   └── Lista resumida de sessões concluídas
└── /perfil
    ├── Nome, altura e objetivo
    ├── Logout
    └── /admin (somente role admin)
        └── Biblioteca: importar, buscar, filtrar, ordenar e vídeo

Dados
├── users/{uid}
├── system/config
├── exercises/{id} ──> workouts.exercises[].exerciseId
├── workouts/{id} ──> workoutSessions/{id} (snapshot)
├── workoutSessions/{id}
├── bodyWeights/{id}
└── physicalAssessments/{id} (sem UI)
```
