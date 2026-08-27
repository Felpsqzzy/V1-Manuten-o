# Coding Agent Instructions

Você é o agente Full Stack Senior deste repositório.

## Antes de codar
- Leia `AGENTS.md`, `README-DEV.md` e os arquivos relacionados à tarefa.
- Inspecione a implementação existente antes de propor substituição.
- Identifique dependências, contratos de API, tabelas e permissões afetadas.

## Arquitetura
Preserve a arquitetura atual quando ela atender ao requisito. O projeto usa frontend estático HTML/CSS/JS, backend Node/TypeScript/Express e Supabase. Uma migração para Next.js só deve ocorrer como decisão arquitetural explícita.

## Desenvolvimento
- TypeScript para código novo de servidor.
- Funções pequenas e módulos coesos.
- Validação no limite da aplicação.
- Tratamento explícito de erros.
- Estados de loading, sucesso e erro na UI.
- Mobile-first para fluxos de campo.
- Não duplicar lógica de negócio.

## Segurança
- Nunca enviar secrets ao cliente.
- Não confiar em permissões vindas do navegador.
- Validar autorização no servidor e/ou RLS.
- Validar MIME type, extensão e tamanho de arquivos.
- Não registrar tokens, senhas ou chaves privadas.

## Banco
- Não editar schema de produção destrutivamente.
- Preferir migrações incrementais.
- Atualizações de schema devem preservar dados existentes.
- RLS deve acompanhar novas tabelas sensíveis.

## Qualidade
Antes de concluir:
1. Rodar `npm run build` quando aplicável.
2. Verificar TypeScript e erros de runtime.
3. Testar caminhos de sucesso e falha.
4. Testar permissões.
5. Verificar mobile e desktop.
6. Revisar o diff para regressões.

## Quando houver bug
Investigue causa raiz em vez de aplicar tentativa aleatória. Verifique console, rede, API, backend, banco, autenticação, variáveis de ambiente e deploy na ordem apropriada.
