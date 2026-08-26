-- BIOTROP • PostgreSQL / Supabase schema versionado
-- Auth é gerenciado por Supabase Auth; não armazene senha em public.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  username text,
  email text,
  phone text,
  department text,
  sector text,
  avatar_url text,
  role_code text not null default 'tecnico',
  app_role text not null default 'tecnico',
  active boolean not null default true,
  is_active boolean not null default true,
  theme text not null default 'dark' check (theme in ('dark','light','system')),
  notifications_enabled boolean not null default true,
  full_name text,
  last_login timestamptz,
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
create index if not exists idx_apontamentos_user_created on public.apontamentos(user_id,created_at desc);

create table if not exists public.material_anexos (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references public.materiais(id) on delete cascade,
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

insert into storage.buckets(id,name,public) values ('profile-pictures','profile-pictures',true) on conflict(id) do update set public=true;
insert into storage.buckets(id,name,public) values ('material-attachments','material-attachments',false) on conflict(id) do nothing;
insert into storage.buckets(id,name,public) values ('utility-evidence','utility-evidence',false) on conflict(id) do nothing;

alter table public.profiles enable row level security;
alter table public.materiais enable row level security;
alter table public.apontamentos enable row level security;
alter table public.material_anexos enable row level security;
alter table public.aprovacao_auditoria enable row level security;
alter table public.user_notifications enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using ((select auth.uid())=id);
drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles for insert to authenticated with check ((select auth.uid())=id);
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);

drop policy if exists materiais_select_own_or_approved on public.materiais;
create policy materiais_select_own_or_approved on public.materiais for select to authenticated using ((select auth.uid())=solicitante_id or status='Aprovado');
drop policy if exists materiais_insert_own on public.materiais;
create policy materiais_insert_own on public.materiais for insert to authenticated with check ((select auth.uid())=solicitante_id);
drop policy if exists materiais_update_own on public.materiais;
create policy materiais_update_own on public.materiais for update to authenticated using ((select auth.uid())=solicitante_id) with check ((select auth.uid())=solicitante_id);

drop policy if exists apontamentos_select_own_or_approved on public.apontamentos;
create policy apontamentos_select_own_or_approved on public.apontamentos for select to authenticated using ((select auth.uid())=user_id or status='Aprovado');
drop policy if exists apontamentos_insert_own on public.apontamentos;
create policy apontamentos_insert_own on public.apontamentos for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists apontamentos_update_own on public.apontamentos;
create policy apontamentos_update_own on public.apontamentos for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

drop policy if exists material_anexos_select_own on public.material_anexos;
create policy material_anexos_select_own on public.material_anexos for select to authenticated using ((select auth.uid())=uploaded_by);
drop policy if exists material_anexos_insert_own on public.material_anexos;
create policy material_anexos_insert_own on public.material_anexos for insert to authenticated with check ((select auth.uid())=uploaded_by);

drop policy if exists notifications_own on public.user_notifications;
create policy notifications_own on public.user_notifications for select to authenticated using ((select auth.uid())=user_id);

-- Storage: fotos de perfil públicas; upload/update somente na pasta do próprio UID.
drop policy if exists profile_pictures_public_read on storage.objects;
create policy profile_pictures_public_read on storage.objects for select using (bucket_id='profile-pictures');
drop policy if exists profile_pictures_insert_self on storage.objects;
create policy profile_pictures_insert_self on storage.objects for insert to authenticated with check (bucket_id='profile-pictures' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists profile_pictures_update_self on storage.objects;
create policy profile_pictures_update_self on storage.objects for update to authenticated using (bucket_id='profile-pictures' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='profile-pictures' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists material_attachments_select_self on storage.objects;
create policy material_attachments_select_self on storage.objects for select to authenticated using (bucket_id='material-attachments' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists material_attachments_insert_self on storage.objects;
create policy material_attachments_insert_self on storage.objects for insert to authenticated with check (bucket_id='material-attachments' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Perfil automático no cadastro Auth.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  insert into public.profiles(id,name,full_name,email,role_code,app_role,active,is_active)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),new.email,'tecnico','tecnico',true,true)
  on conflict(id) do update set email=excluded.email,updated_at=now();
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_biotrop on auth.users;
create trigger on_auth_user_created_biotrop after insert on auth.users for each row execute procedure public.handle_new_auth_user();
