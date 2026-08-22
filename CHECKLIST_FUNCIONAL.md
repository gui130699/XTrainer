# Checklist Funcional do XTrainer

> Atualizado em 22/08/2026 — troca de exercício com escopo, pular exercício, alternativas
> preferidas, feedback tátil/sonoro do cronômetro, tela sempre ativa, resumo mensal e wrapped
> anual foram implementados e verificados por lint/TypeScript/testes/build.

## Autenticação
- [x] Login por e-mail e senha
- [x] Cadastro de usuário
- [x] Recuperação de senha
- [x] Logout
- [x] Administrador único via `system/config.adminUid` (sem bootstrap público)
- [x] Proteção de rota comum e admin
- [ ] Erros tratados em todos os fluxos (reset não trata falha)

## Biblioteca
- [x] Dataset padrão com 202 exercícios em código
- [x] Importação/substituição idempotente pelo admin
- [x] Busca por português, inglês e aliases sem acento
- [x] Filtro muscular e ordenação no admin
- [x] Link de vídeo seguro
- [ ] Criar/editar/remover exercício individual pela UI do admin (hoje só substituição em lote)

## Treinos e sessões
- [x] Criar/editar/duplicar/arquivar/excluir treino com múltiplos exercícios
- [x] Métodos de treino dinâmicos (14 motores: normal, group, drop, rest-pause, cluster,
      progressão, top/back-off, tempo, falha, AMRAP, isometria, parciais, myo-reps, tempo)
- [x] Grupos de exercício (bi-set, tri-set, super-set, série gigante)
- [x] Iniciar sessão e registrar carga/repetições
- [x] Última carga usada por posição de série pré-preenchida na próxima sessão
- [x] Calcular volume por série concluída
- [x] Adicionar/remover série extra na sessão
- [x] Cronômetro de descanso com notificação do navegador, som e vibração (preferências
      locais, dedupe por `restEndsAt`)
- [x] Tela sempre ativa durante a sessão (Screen Wake Lock, opcional, só com sessão ativa)
- [x] Retomar sessão ativa após reload
- [x] Cancelar sessão / desfazer série / remover série
- [x] Trocar exercício só nesta sessão ou definitivamente, preservando a identidade real das
      séries já concluídas
- [x] Pular exercício apenas na sessão do dia, com motivo opcional e desfazer
- [x] Alternativas de troca preferidas por exercício, com atalho no seletor de troca

## Histórico e evolução
- [x] Listar sessões concluídas paginadas, com filtro por período/treino/exercício
- [x] Abrir detalhes da sessão (série a série, com substituições e exercícios pulados
      indicados)
- [x] Exportar histórico em CSV e PDF
- [x] Mostrar gráfico de peso real
- [x] Registrar/editar/excluir peso como usuário comum
- [x] Avaliações físicas rápidas/completas/avançadas e medidas corporais (sem fotos — Storage
      foi removido do projeto)
- [x] Recordes pessoais e histórico por exercício, com identidade real pós-troca
- [x] Resumo mensal automático (`/resumos?tab=mensal`) com comparação ao mês anterior
- [x] XTrainer Wrapped anual (`/resumos?tab=anual`), com compartilhamento via Web Share API

## Perfil/PWA
- [x] Alterar nome, altura, objetivo, sexo e data de nascimento (seletores dia/mês/ano)
- [x] Alterar e-mail/senha
- [ ] Foto de perfil — removida deliberadamente (sem Firebase Storage no plano gratuito)
- [x] Manifesto, ícone e service worker
- [x] Cache persistente Firestore configurado; indicador de sincronização na sessão ativa
- [x] Tema claro/escuro, com detecção de preferência do sistema
- [x] Atualização automática do PWA (recarrega sozinho ao detectar novo service worker)
