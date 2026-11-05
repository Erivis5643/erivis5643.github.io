-- Roundhouse MVP schema for Supabase (Postgres + Auth + Row Level Security)
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username = lower(username) and username ~ '^[a-z0-9_]{3,24}$'),
  bio text not null default '' check (char_length(bio) <= 240),
  created_at timestamptz not null default now()
);

create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  folder text not null default 'Unsorted' check (char_length(folder) <= 40),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  is_saved boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.workout_plans add column if not exists folder text not null default 'Unsorted';

create index if not exists workout_plans_owner_created_idx on public.workout_plans (user_id, created_at desc);
create index if not exists workout_plans_public_created_idx on public.workout_plans (created_at desc) where visibility = 'public';
create index if not exists profiles_username_idx on public.profiles (username);

alter table public.profiles enable row level security;
alter table public.workout_plans enable row level security;

drop policy if exists "Profiles are visible to everyone" on public.profiles;
create policy "Profiles are visible to everyone" on public.profiles for select using (true);
drop policy if exists "Users create their own profile" on public.profiles;
create policy "Users create their own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Public plans and owner history are readable" on public.workout_plans;
create policy "Public plans and owner history are readable" on public.workout_plans for select using (visibility = 'public' or auth.uid() = user_id);
drop policy if exists "Users create their own plans" on public.workout_plans;
create policy "Users create their own plans" on public.workout_plans for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update their own plans" on public.workout_plans;
create policy "Users update their own plans" on public.workout_plans for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete their own plans" on public.workout_plans;
create policy "Users delete their own plans" on public.workout_plans for delete to authenticated using (auth.uid() = user_id);

-- Searchable public views are intentionally read-only to other users. Clients may
-- update their own username/bio and their own workout visibility under RLS.
