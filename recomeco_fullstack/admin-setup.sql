-- Execute no SQL Editor do Supabase para habilitar o painel admin em um projeto existente.
-- Este script não promove nenhuma conta automaticamente.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "admin_users_select_own" on public.admin_users;
create policy "admin_users_select_own" on public.admin_users
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.admin_users from public, anon, authenticated;
grant select on public.admin_users to authenticated;

alter table public.support_resources enable row level security;
grant select on public.support_resources to anon, authenticated;
grant insert, update, delete on public.support_resources to authenticated;

drop policy if exists "resources_admin_read" on public.support_resources;
create policy "resources_admin_read" on public.support_resources
  for select to authenticated using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );
drop policy if exists "resources_admin_insert_clinics" on public.support_resources;
create policy "resources_admin_insert_clinics" on public.support_resources
  for insert to authenticated with check (
    category = 'Clínicas'
    and exists (select 1 from public.admin_users where user_id = auth.uid())
  );
drop policy if exists "resources_admin_update_clinics" on public.support_resources;
create policy "resources_admin_update_clinics" on public.support_resources
  for update to authenticated
  using (
    category = 'Clínicas'
    and exists (select 1 from public.admin_users where user_id = auth.uid())
  )
  with check (
    category = 'Clínicas'
    and exists (select 1 from public.admin_users where user_id = auth.uid())
  );
drop policy if exists "resources_admin_delete_clinics" on public.support_resources;
create policy "resources_admin_delete_clinics" on public.support_resources
  for delete to authenticated using (
    category = 'Clínicas'
    and exists (select 1 from public.admin_users where user_id = auth.uid())
  );
