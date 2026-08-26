-- BIOTROP • migração incremental do sistema existente
-- Execute no SQL Editor do projeto xxqipgvdksughongzpqj.
create extension if not exists pgcrypto;

alter table public.utility_readings add column if not exists photo_path text;
alter table public.utility_readings add column if not exists captured_at timestamptz;
alter table public.service_requests add column if not exists approved_at timestamptz;
alter table public.service_requests add column if not exists approved_by uuid;
alter table public.purchase_requests add column if not exists approved_at timestamptz;
alter table public.purchase_requests add column if not exists approved_by uuid;

create table if not exists public.approval_notifications (
  id uuid primary key default gen_random_uuid(), request_id uuid not null, request_type text not null check (request_type in ('SCI','SCM')), request_number text not null, recipient_emails text[] not null default '{}', subject text not null, status text not null default 'pending' check (status in ('pending','sent','failed')), error_message text, created_at timestamptz not null default now(), sent_at timestamptz
);
create unique index if not exists ux_approval_notification_request on public.approval_notifications(request_id,request_type);
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, title text not null, message text not null, notification_type text not null default 'info', read_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists idx_user_notifications_user_created on public.user_notifications(user_id,created_at desc);

insert into storage.buckets(id,name,public) values ('avatars','avatars',true) on conflict(id) do update set public=true;
insert into storage.buckets(id,name,public) values ('utility-evidence','utility-evidence',false) on conflict(id) do nothing;

alter table public.approval_notifications enable row level security;
alter table public.user_notifications enable row level security;
revoke all on public.approval_notifications from anon,authenticated;
revoke all on public.user_notifications from anon,authenticated;
grant insert on public.approval_notifications to authenticated;
grant select on public.user_notifications to authenticated;

drop policy if exists approval_notifications_insert on public.approval_notifications;
create policy approval_notifications_insert on public.approval_notifications for insert to authenticated with check (true);
drop policy if exists user_notifications_own on public.user_notifications;
create policy user_notifications_own on public.user_notifications for select to authenticated using ((select auth.uid())=user_id);

drop policy if exists avatar_public_read on storage.objects;
create policy avatar_public_read on storage.objects for select using (bucket_id='avatars');
drop policy if exists avatar_insert_own on storage.objects;
create policy avatar_insert_own on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists avatar_update_own on storage.objects;
create policy avatar_update_own on storage.objects for update to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists avatar_delete_own on storage.objects;
create policy avatar_delete_own on storage.objects for delete to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists utility_evidence_own_select on storage.objects;
create policy utility_evidence_own_select on storage.objects for select to authenticated using (bucket_id='utility-evidence' and (storage.foldername(name))[1]='utility-readings' and (storage.foldername(name))[2]=(select auth.uid())::text);
drop policy if exists utility_evidence_own_insert on storage.objects;
create policy utility_evidence_own_insert on storage.objects for insert to authenticated with check (bucket_id='utility-evidence' and (storage.foldername(name))[1]='utility-readings' and (storage.foldername(name))[2]=(select auth.uid())::text);
