# Checklist Funcional do XTrainer

## Autenticação
- [x] Login por e-mail e senha
- [x] Cadastro de usuário
- [x] Recuperação de senha
- [x] Logout
- [x] Primeiro administrador com regra Firestore
- [x] Proteção de rota comum e admin
- [ ] Erros tratados em todos os fluxos (reset não trata falha)

## Biblioteca
- [x] Dataset padrão com 202 exercícios em código
- [x] Importação idempotente pelo admin
- [x] Busca por português, inglês e aliases sem acento
- [x] Filtro muscular e ordenação no admin
- [x] Link de vídeo seguro
- [ ] Confirmar importação real no Firestore nesta auditoria
- [ ] Criar/editar/remover/desativar exercício pela UI

## Treinos e sessões
- [x] Criar treino com um exercício
- [ ] Adicionar vários exercícios
- [ ] Editar/excluir/duplicar/reordenar treino
- [x] Iniciar sessão e registrar carga/repetições
- [x] Calcular volume por série concluída
- [x] Adicionar série extra na sessão
- [x] Timer básico com pular e +15s
- [ ] Pausar/alertar/persistir timer
- [ ] Retomar sessão ativa após reload
- [ ] Cancelar/desfazer série/remover série

## Histórico e evolução
- [x] Listar sessões concluídas resumidas
- [ ] Abrir detalhes da sessão
- [x] Mostrar gráfico de peso real
- [ ] Registrar peso como usuário comum
- [ ] Editar/excluir/listar pesagens
- [ ] Avaliações físicas, medidas e fotos
- [ ] Recordes pessoais e histórico por exercício

## Perfil/PWA
- [x] Alterar nome, altura e objetivo
- [ ] Alterar e-mail/senha/foto/sexo/nascimento
- [x] Manifesto, ícone e service worker
- [x] Cache persistente Firestore configurado
- [ ] UX de sincronização/offline e atualização PWA
