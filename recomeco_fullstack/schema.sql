
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('CAPS AD','Saúde pública','Mútua ajuda','Familiares','Clínicas')),
  address text,
  city text not null,
  state text,
  description text not null,
  phone text,
  website text,
  is_published boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_resources
  drop constraint if exists support_resources_category_check;
alter table public.support_resources
  add constraint support_resources_category_check
  check (category in ('CAPS AD','Saúde pública','Mútua ajuda','Familiares','Clínicas'));
alter table public.support_resources
  add column if not exists address text;

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text not null,
  description text not null,
  body text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) <= 120),
  body text not null check (char_length(body) <= 3000),
  mood text check (mood is null or mood in ('bem','neutro','difícil')),
  created_at timestamptz not null default now()
);

create index if not exists support_resources_published_idx
  on public.support_resources (is_published, category, city);
create index if not exists journal_entries_user_created_idx
  on public.journal_entries (user_id, created_at desc);
create index if not exists content_items_published_idx
  on public.content_items (is_published, category);

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.support_resources enable row level security;
alter table public.content_items enable row level security;
alter table public.journal_entries enable row level security;

-- Perfis: cada usuário lê e atualiza apenas o próprio perfil.
drop policy if exists "profile_select_own" on public.profiles;
create policy "profile_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);
drop policy if exists "profile_insert_own" on public.profiles;
create policy "profile_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
drop policy if exists "profile_update_own" on public.profiles;
create policy "profile_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Diretório: leitura pública apenas para registros publicados.
drop policy if exists "resources_public_read" on public.support_resources;
create policy "resources_public_read" on public.support_resources
  for select to anon, authenticated using (is_published = true);

-- A lista de administradores só pode ser consultada pelo próprio usuário.
-- Não há políticas públicas de escrita; promova o primeiro admin pelo SQL Editor.
drop policy if exists "admin_users_select_own" on public.admin_users;
create policy "admin_users_select_own" on public.admin_users
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.admin_users from public, anon, authenticated;
grant select on public.admin_users to authenticated;
grant select on public.support_resources to anon, authenticated;
grant insert, update, delete on public.support_resources to authenticated;

-- Somente administradores podem consultar registros não publicados e gerenciar clínicas.
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

-- Conteúdos: leitura pública apenas para materiais publicados.
drop policy if exists "content_public_read" on public.content_items;
create policy "content_public_read" on public.content_items
  for select to anon, authenticated using (is_published = true);

-- Diário: somente o proprietário autenticado pode ler, inserir, alterar ou apagar.
drop policy if exists "journal_select_own" on public.journal_entries;
create policy "journal_select_own" on public.journal_entries
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "journal_insert_own" on public.journal_entries;
create policy "journal_insert_own" on public.journal_entries
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "journal_update_own" on public.journal_entries;
create policy "journal_update_own" on public.journal_entries
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "journal_delete_own" on public.journal_entries;
create policy "journal_delete_own" on public.journal_entries
  for delete to authenticated using (auth.uid() = user_id);

-- Cria automaticamente um perfil básico após cadastro no Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Atualização automática de updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists resources_updated_at on public.support_resources;
create trigger resources_updated_at before update on public.support_resources
  for each row execute procedure public.set_updated_at();

drop trigger if exists content_updated_at on public.content_items;
create trigger content_updated_at before update on public.content_items
  for each row execute procedure public.set_updated_at();

-- Não há política de escrita pública para o diretório/conteúdos.
-- Gerencie esses registros pelo painel Supabase ou por backend administrativo confiável.
