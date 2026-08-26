-- BIOTROP • PostgreSQL / Supabase schema versionado
-- A autenticação de usuários é feita pelo Supabase Auth (auth.users).
-- Não crie uma tabela users para guardar senha; o hash de senha fica no Auth.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  full_name text,
  email text,
  phone text,
  sector text,
  department text,
  role text not null default 'tecnico' check (role in ('tecnico','almoxarife','pcm','gestor','aprovador','admin')),
  avatar_url text,
  theme text not null default 'dark' check (theme in ('dark','light','system')),
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.materiais (
  id uuid primary key default gen_random_uuid(),
  codigo_item text,
  descricao text not null,
  categoria text,
  quantidade numeric(14,3) not null default 1 check (quantidade >= 0),
  unidade text not null default 'UN',
  observacoes text,
  status text not null default 'Pendente' check (status in ('Pendente','Aprovado','Rejeitado')),
  solicitante_id uuid references auth.users(id) on delete set null,
  aprovado_por uuid references auth.users(id) on delete set null,
  aprovado_em timestamptz,
  rejeitado_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_materiais_status on public.materiais(status);
create index if not exists idx_materiais_solicitante on public.materiais(solicitante_id);
create index if not exists idx_materiais_codigo on public.materiais(codigo_item);

create table if not exists public.apontamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  equipamento text,
  valor numeric(14,3),
  unidade text,
  observacao text,
  status text not null default 'Pendente' check (status in ('Pendente','Aprovado','Rejeitado')),
  aprovado_por uuid references auth.users(id) on delete set null,
  aprovado_em timestamptz,
  rejeitado_motivo text,
  foto_path text,
  video_path text,
  latitude double precision,
  longitude double precision,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_apontamentos_status on public.apontamentos(status);
create index if not exists idx_apontamentos_user_created on public.apontamentos(user_id, created_at desc);

create table if not exists public.material_anexos (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiais(id) on delete cascade,
  nome_arquivo text not null,
  mime_type text,
  tamanho_bytes bigint,
  storage_path text not null,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_material_anexos_material on public.material_anexos(material_id);

create table if not exists public.aprovacao_auditoria (
  id uuid primary key default gen_random_uuid(),
  entidade text not null,
  registro_id uuid not null,
  status_anterior text,
  status_novo text not null,
  aprovado_por uuid references auth.users(id) on delete set null,
  motivo text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Storage
insert into storage.buckets(id,name,public)
values ('profile-pictures','profile-pictures',true)
on conflict(id) do update set public=true;

insert into storage.buckets(id,name,public)
values ('material-attachments','material-attachments',false)
on conflict(id) do nothing;

insert into storage.buckets(id,name,public)
values ('utility-evidence','utility-evidence',false)
on conflict(id) do nothing;

-- RLS
alter table public.profiles enable row level security;
alter table public.materiais enable row level security;
alter table public.apontamentos enable row level security;
alter table public.material_anexos enable row level security;
alter table public.aprovacao_auditoria enable row level security;
alter table public.user_notifications enable row level security;

-- Perfil próprio
 drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Materiais: usuário cria/lê os próprios; aprovadores leem/decidem pendências via função segura ou perfil com role
 drop policy if exists materiais_own_select on public.materiais;
create policy materiais_own_select on public.materiais for select to authenticated
using ((select auth.uid()) = solicitante_id or status = 'Aprovado');

drop policy if exists materiais_own_insert on public.materiais;
create policy materiais_own_insert on public.materiais for insert to authenticated
with check ((select auth.uid()) = solicitante_id);

drop policy if exists materiais_own_update on public.materiais;
create policy materiais_own_update on public.materiais for update to authenticated
using ((select auth.uid()) = solicitante_id)
with check ((select auth.uid()) = solicitante_id);

-- Apontamentos do próprio usuário
 drop policy if exists apontamentos_own_select on public.apontamentos;
create policy apontamentos_own_select on public.apontamentos for select to authenticated
using ((select auth.uid()) = user_id or status = 'Aprovado');

drop policy if exists apontamentos_own_insert on public.apontamentos;
create policy apontamentos_own_insert on public.apontamentos for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists apontamentos_own_update on public.apontamentos;
create policy apontamentos_own_update on public.apontamentos for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Anexos: somente o dono do material pode inserir/consultar seus arquivos
 drop policy if exists material_anexos_select on public.material_anexos;
create policy material_anexos_select on public.material_anexos for select to authenticated
using ((select auth.uid()) = uploaded_by);

drop policy if exists material_anexos_insert on public.material_anexos;
create policy material_anexos_insert on public.material_anexos for insert to authenticated
with check ((select auth.uid()) = uploaded_by);

-- Auditoria e notificações
 drop policy if exists auditoria_select on public.aprovacao_auditoria;
create policy auditoria_select on public.aprovacao_auditoria for select to authenticated
using ((select auth.uid()) = aprovado_por);

drop policy if exists notifications_own on public.user_notifications;
create policy notifications_own on public.user_notifications for select to authenticated
using ((select auth.uid()) = user_id);

-- Storage: foto pública, gravação somente na pasta do próprio usuário.
drop policy if exists profile_pictures_public_read on storage.objects;
create policy profile_pictures_public_read on storage.objects
for select using (bucket_id='profile-pictures');

drop policy if exists profile_pictures_insert_self on storage.objects;
create policy profile_pictures_insert_self on storage.objects
for insert to authenticated
with check (bucket_id='profile-pictures' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists profile_pictures_update_self on storage.objects;
create policy profile_pictures_update_self on storage.objects
for update to authenticated
using (bucket_id='profile-pictures' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id='profile-pictures' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Storage de anexos de materiais: privado, acesso apenas ao usuário que enviou.
drop policy if exists material_attachments_insert_self on storage.objects;
create policy material_attachments_insert_self on storage.objects
for insert to authenticated
with check (bucket_id='material-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists material_attachments_select_self on storage.objects;
create policy material_attachments_select_self on storage.objects
for select to authenticated
using (bucket_id='material-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Trigger para registrar perfil automaticamente após cadastro no Auth.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.profiles(id,name,full_name,email,role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    'tecnico'
  )
  on conflict (id) do update set email=excluded.email, updated_at=now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_biotrop on auth.users;
create trigger on_auth_user_created_biotrop
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

-- Auditoria de aprovação/rejeição
create or replace function public.audit_material_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.aprovacao_auditoria(entidade,registro_id,status_anterior,status_novo,aprovado_por,motivo)
    values('materiais',new.id,old.status,new.status,new.aprovado_por,new.rejeitado_motivo);
  end if;
  return new;
end;
$$;

drop trigger if exists materiais_status_audit on public.materiais;
create trigger materiais_status_audit
after update of status on public.materiais
for each row execute procedure public.audit_material_status();
