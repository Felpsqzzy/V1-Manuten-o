# BIOTROP — Gestão Industrial

Aplicação industrial com Supabase, autenticação, SCI/SCM, utilidades, horímetros, treinamentos e dashboard.

## Melhorias integradas
- Relógio CMC em tempo real.
- Configurações de usuário com avatar no Supabase Storage, nome, e-mail, telefone e troca opcional de senha.
- Dashboard reativo aos apontamentos do banco.
- Horímetro com foto obrigatória, GPS quando disponível, usuário e timestamp do servidor.
- Fluxo de SCI/SCM preparado para notificação e aprovação do almoxarife.
- Edge Function para envio de e-mail via Resend.

## E-mail de aprovação
Configure no projeto Supabase as secrets `RESEND_API_KEY` e `RESEND_FROM_EMAIL` para que a Edge Function envie e-mails reais.
