# Treinamento do Agente Full Stack

## Objetivo
Treinar o agente para entregar aplicações profissionais de ponta a ponta no projeto BIOTROP Gestão Industrial.

## Missões

### Nível 1 — Fundamentos
- [ ] Inspecionar a arquitetura existente e produzir mapa do projeto.
- [ ] Corrigir um bug de UI sem regressão.
- [ ] Criar componente de formulário responsivo.
- [ ] Implementar validação de campos.
- [ ] Melhorar estado de loading/erro.

### Nível 2 — Backend
- [ ] Criar endpoint CRUD com validação.
- [ ] Implementar tratamento padronizado de erros.
- [ ] Implementar paginação e filtros.
- [ ] Validar autenticação no servidor.
- [ ] Implementar autorização por papel.

### Nível 3 — PostgreSQL/Supabase
- [ ] Modelar entidade nova.
- [ ] Criar migration incremental.
- [ ] Criar índices necessários.
- [ ] Criar políticas RLS.
- [ ] Criar auditoria de operações críticas.

### Nível 4 — Integração Full Stack
- [ ] Criar fluxo completo frontend → API → banco.
- [ ] Implementar upload para Storage e referência no banco.
- [ ] Implementar registro de data/hora e usuário.
- [ ] Implementar captura de GPS em operação de campo.
- [ ] Implementar dashboard alimentado por dados reais.

### Nível 5 — Qualidade
- [ ] Criar testes de unidade para regra de negócio.
- [ ] Criar testes de API.
- [ ] Testar usuário sem permissão.
- [ ] Testar dados inválidos.
- [ ] Investigar e corrigir erro de produção usando logs.

### Nível 6 — DevOps
- [ ] Validar build no CI.
- [ ] Criar preview por branch/PR.
- [ ] Validar variáveis de ambiente sem expor valores.
- [ ] Publicar frontend compatível com Vercel.
- [ ] Verificar deployment e runtime após publicação.

## Desafio principal do projeto
Construir e manter o sistema industrial com os módulos:

- Manutenção
- SCI
- SCM
- Almoxarifado
- CMC
- Utilidades
- Horímetros
- Usuários e permissões
- Dashboards

## Critério de aprovação
O agente não deve ser avaliado somente por código que compila. A missão é aprovada quando a funcionalidade estiver integrada, segura, persistida, responsiva e validada contra os requisitos.

## Regra de evolução
Após cada missão, registrar:
- problema
- solução
- arquivos alterados
- testes executados
- falhas encontradas
- correção aplicada
- aprendizado reutilizável
