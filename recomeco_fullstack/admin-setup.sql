-- Execute no SQL Editor do Supabase para habilitar o painel admin em um projeto existente.
-- Este script não promove nenhuma conta automaticamente.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  content text not null check (char_length(btrim(content)) between 20 and 800),
  consent boolean not null default false check (consent = true),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists testimonials_published_created_idx
  on public.testimonials (is_published, created_at desc);

alter table public.admin_users enable row level security;
alter table public.testimonials enable row level security;

drop policy if exists "admin_users_select_own" on public.admin_users;
create policy "admin_users_select_own" on public.admin_users
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.admin_users from public, anon, authenticated;
grant select on public.admin_users to authenticated;

alter table public.support_resources enable row level security;
grant select on public.support_resources to anon, authenticated;
grant insert, update, delete on public.support_resources to authenticated;

revoke all on public.testimonials from public, anon, authenticated;
grant select on public.testimonials to anon, authenticated;
grant insert on public.testimonials to anon, authenticated;
grant update on public.testimonials to authenticated;
grant delete on public.testimonials to authenticated;

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

drop policy if exists "testimonials_public_read" on public.testimonials;
create policy "testimonials_public_read" on public.testimonials
  for select to anon, authenticated using (is_published = true);
drop policy if exists "testimonials_admin_read" on public.testimonials;
create policy "testimonials_admin_read" on public.testimonials
  for select to authenticated using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );
drop policy if exists "testimonials_public_insert_pending" on public.testimonials;
create policy "testimonials_public_insert_pending" on public.testimonials
  for insert to anon, authenticated with check (
    is_published = false and consent = true
  );
drop policy if exists "testimonials_admin_update" on public.testimonials;
create policy "testimonials_admin_update" on public.testimonials
  for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));
drop policy if exists "testimonials_admin_delete" on public.testimonials;
create policy "testimonials_admin_delete" on public.testimonials
  for delete to authenticated using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );
