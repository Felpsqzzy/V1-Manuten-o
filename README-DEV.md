# BIOTROP — Gestão Industrial

## Camadas
- `app.html`: aplicação existente preservada.
- `style.css`: design system premium, dark mode e responsividade.
- `app.js`: ponte de autenticação Supabase, sessão persistente e melhorias de UI.
- `schema.sql`: PostgreSQL versionado para Supabase.
- `server/`: Node.js + TypeScript + Express para API e uploads.
- `assets/`: módulos de aprovação, horímetro e anexos.

## Supabase Auth
O login do frontend usa `supabase.auth.signInWithPassword()` e `getSession()`. A sessão fica persistida pelo cliente Supabase. Não coloque `service_role` no navegador.

## Backend local
```bash
npm install
npm run dev
```

Variáveis do `.env` do backend:
```env
PORT=3000
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=SUA_PUBLISHABLE_OU_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
UPLOAD_DIR=./uploads
```

## Banco
Execute `schema.sql` no SQL Editor do projeto Supabase para uma instalação nova. Em um projeto já existente, aplique apenas as migrações incrementais equivalentes para não apagar dados.

## Uploads
O frontend usa Supabase Storage para anexos de material. Os formatos previstos incluem imagens, vídeos, PDF, DOC/DOCX, XLS/XLSX, CSV e TXT. Limite de 150 MB no fluxo web e 100 MB no endpoint Express de exemplo.

## Vercel
O frontend continua estático e usa `index.html` como entrada. O backend Express fica separado para execução Node; em produção, ele pode ser hospedado em um serviço Node dedicado ou convertido para Functions.
