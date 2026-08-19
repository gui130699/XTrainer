# RELATÓRIO DE IMPLEMENTAÇÃO — MÉTODOS DE TREINO DINÂMICOS

Data: 18/08/2026  
Projetos: XTrainer e XTrainer-Admin  
Firebase: xtrainer-45f8d

## Resultado

O sistema deixou de depender de tipos de série fixos na interface. O catálogo global `trainingMethods` agora define, de forma segura e versionada, como cada método é configurado e executado. O Admin altera definições globais; o usuário escolhe métodos ativos, configura seus parâmetros e salva um snapshot dentro do treino. Sessões também preservam esse snapshot.

Foram publicados 24 métodos padrão:

1. Séries normais
2. Aquecimento
3. Séries de aproximação
4. Bi-set
5. Tri-set
6. Super-set
7. Giant set
8. Drop-set
9. Rest-pause
10. Pirâmide crescente
11. Pirâmide decrescente
12. Top set
13. Back-off
14. Top set + back-off
15. Cluster set
16. Myo-reps
17. Até a falha
18. AMRAP
19. Isometria
20. Repetições parciais
21. Tempo controlado
22. Pré-exaustão
23. Pós-exaustão
24. Série por tempo

## Arquitetura entregue

### Catálogo global

Coleção: `trainingMethods/{methodId}`.

Cada definição contém identificação, descrições, categoria, motor, ícone, ordem, estado, origem, versão, capacidades, regras de quantidade de exercícios, esquema de parâmetros e valores padrão.

Tipos de campo permitidos: `number`, `integer`, `percentage`, `seconds`, `reps`, `boolean`, `select`, `text`, `tempo` e `load`.

Motores permitidos: `normal`, `group`, `drop`, `rest-pause`, `cluster`, `progression`, `top-backoff`, `tempo`, `failure`, `amrap`, `isometric`, `partials`, `myo-reps` e `time`.

Não há JavaScript, HTML, expressões executáveis ou `eval` configuráveis pelo administrador.

### Snapshot e retrocompatibilidade

`WorkoutExercise` grava `methodConfig` e `methodSnapshot`. `WorkoutExerciseGroup` grava a definição e configuração do método combinado. `WorkoutSession` preserva os grupos e cada `SessionExercise.target` contém o snapshot que originou a execução.

Treinos antigos sem método são normalizados como “Séries normais”. Renomear, editar ou desativar o catálogo não altera treinos já salvos nem históricos. Mudanças comportamentais de motor, esquema, capacidades, regras ou padrões incrementam a versão.

### Execução por etapas

As séries executadas podem conter motor, versão, bloco, etapa, papel, duração, cadência, descanso e indicador de falha. O gerador cria todas as etapas antes da sessão:

- drop-set: série principal e reduções de carga;
- rest-pause: principal e blocos após micropausa;
- cluster: blocos de repetições com micropausas;
- progressão/pirâmide: variação de carga e repetições;
- top/back-off: séries principais e recuos;
- myo-reps: ativação e minisséries;
- parciais: etapa completa e etapa parcial;
- tempo: cadência em quatro fases;
- isometria e séries por tempo: duração;
- falha e AMRAP: indicador explícito;
- grupos: rodadas intercaladas na ordem dos exercícios.

Em métodos combinados, o descanso entre membros e o descanso ao final da rodada são independentes. O descanso longo ocorre apenas após o último exercício da rodada.

### Métricas

Volume usa carga × repetições reais em todas as etapas concluídas. Aquecimento e aproximação permanecem no histórico, mas são excluídos das métricas efetivas e dos recordes. Drop, rest-pause, cluster, myo-reps e parciais contam suas etapas reais.

## Painel administrativo

Nova rota `/metodos` com:

- indicadores de total, ativos e personalizados;
- pesquisa e filtros por categoria, motor e estado;
- cartões com estado, versão, origem e ordem;
- cadastro e edição em seis etapas;
- seletor de motor seguro;
- capacidades e regras de quantidade de exercícios;
- editor visual do esquema;
- editor visual de valores padrão;
- ativação/desativação;
- duplicação;
- sincronização idempotente dos 24 padrões;
- logs de auditoria.

Nova rota `/sistema` apresenta integridade do catálogo e reforça a separação de responsabilidades. O dashboard ganhou o indicador de métodos ativos.

## Aplicativo do usuário

A criação/edição de treino agora oferece:

- seletor pesquisável de métodos ativos;
- categorias e descrições;
- formulário gerado pelo esquema do método;
- campos básicos condicionados às capacidades;
- aviso para método desativado já preservado;
- criação de grupos com ordem;
- validação de mínimo, máximo e grupo muscular;
- snapshot no salvamento.

A execução mostra o nome e as instruções do método, rótulos de cada etapa e campos específicos de repetição, carga, tempo ou cadência. Grupos aparecem por rodada e na ordem correta. O histórico mostra método e rótulo das etapas.

## Segurança e dados publicados

Regras:

- leitura de `trainingMethods`: qualquer usuário autenticado;
- escrita de `trainingMethods`: somente o UID administrativo definido em `system/config`;
- usuário comum não cria, altera nem remove métodos;
- treinos e sessões continuam privados pelo `ownerId`;
- Admin não recebe acesso a treinos, sessões, evolução ou avaliações privadas.

Em 18/08/2026:

- 24 métodos padrão foram sincronizados no Firestore real;
- métodos personalizados existentes foram preservados;
- regras compiladas e publicadas no projeto `xtrainer-45f8d`.

Índices: nenhum índice composto novo é necessário. O catálogo é pequeno, lido globalmente e ordenado/filtrado no cliente; os índices existentes permanecem válidos.

## Testes e validações

Cobertura automatizada adicionada para:

- séries normais;
- grupos e descanso após o último membro;
- drop-set com volume real de 1.595 kg;
- rest-pause;
- cluster;
- progressão/pirâmide;
- top/back-off;
- tempo controlado;
- AMRAP;
- isometria;
- aquecimento/aproximação fora das métricas efetivas;
- snapshot após renomear/desativar catálogo;
- método personalizado quad-set;
- drop-set personalizado.

Resultado registrado:

- testes unitários: 20/20;
- testes de regras: 10/10;
- contrato compartilhado: sincronizado;
- typecheck: aprovado nos dois projetos;
- lint: aprovado nos dois projetos;
- build estático: aprovado nos dois projetos.

## Arquivos centrais

- `src/types/index.ts`
- `src/data/default-training-methods.ts`
- `src/lib/training-methods.ts`
- `src/services/training-methods.ts`
- `src/app/treino/page.tsx`
- `src/components/training-methods/*`
- `src/app/metodos/page.tsx`
- `src/app/sistema/page.tsx`
- `firestore.rules`
- `tests/training-methods.test.ts`
- `tests/firestore.rules.test.mjs`
- `scripts/seed-training-methods.ts`

## Operação

Para ressincronizar apenas os métodos padrão, preservando personalizados e o estado ativo já existente:

```bash
cd XTrainer-Admin
npm run seed:training-methods -- --project=xtrainer-45f8d
```

Para validar:

```bash
cd XTrainer
npm run typecheck
npm run lint
npm run test
npm run build

cd ../XTrainer-Admin
npm run typecheck
npm run lint
npm run test
npm run build
```
