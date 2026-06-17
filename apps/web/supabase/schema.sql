-- QuadState cloud schema + Row-Level Security.
-- Run this once in the Supabase dashboard → SQL editor.
--
-- Security model: RLS is the access boundary. Owners can CRUD their own rows;
-- anyone (including anonymous visitors) may SELECT a project only when it is
-- marked public — that powers read-only share links. The random share_slug is
-- just an unguessable lookup key layered on top of the is_public gate.

-- ---------------------------------------------------------------- projects
-- One row per cloud project. `doc` stores the ProjectFile JSON blob verbatim
-- as text (NOT jsonb) so the saved artifact round-trips byte-for-byte.
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  name        text not null default 'Untitled circuit',
  doc         text not null,
  is_public   boolean not null default false,
  share_slug  text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists projects_owner_updated_idx
  on public.projects (owner, updated_at desc);
create index if not exists projects_share_slug_idx
  on public.projects (share_slug) where share_slug is not null;

alter table public.projects enable row level security;

drop policy if exists owner_select on public.projects;
drop policy if exists owner_insert on public.projects;
drop policy if exists owner_update on public.projects;
drop policy if exists owner_delete on public.projects;
drop policy if exists public_read_shared on public.projects;

create policy owner_select on public.projects
  for select using (auth.uid() = owner);
create policy owner_insert on public.projects
  for insert with check (auth.uid() = owner);
create policy owner_update on public.projects
  for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy owner_delete on public.projects
  for delete using (auth.uid() = owner);
-- Anyone (incl. anonymous) may read a project row only when it is public.
-- Postgres OR-combines this with owner_select, so owners still see all rows.
create policy public_read_shared on public.projects
  for select using (is_public = true);

-- ----------------------------------------------------------- user_settings
-- One row per user; the editor preferences blob (small, field-merged → jsonb).
create table if not exists public.user_settings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists settings_rw on public.user_settings;
create policy settings_rw on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
