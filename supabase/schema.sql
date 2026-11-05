-- Personal boxing timer workout schema for Supabase (Postgres + Auth + RLS)
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
  category text not null default 'Other' check (char_length(category) <= 40),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  is_saved boolean not null default false,
  source_label text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  scheduled_for date
);

alter table public.workout_plans add column if not exists folder text not null default 'Unsorted';
alter table public.workout_plans add column if not exists category text not null default 'Other';
update public.workout_plans set category = coalesce(nullif(folder, 'Unsorted'), 'Other') where category = 'Other';
alter table public.workout_plans add column if not exists scheduled_for date;
alter table public.workout_plans add column if not exists source_label text not null default '';

create index if not exists workout_plans_owner_created_idx on public.workout_plans (user_id, created_at desc);
create index if not exists workout_plans_public_created_idx on public.workout_plans (created_at desc) where visibility = 'public';
create index if not exists workout_plans_category_idx on public.workout_plans (user_id, category);
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

-- Workout sharing is a recipient-only snapshot; it does not grant edit access to the original.
create table if not exists public.workout_shares (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid references public.workout_plans(id) on delete set null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sender_label text not null default '',
  workout_snapshot jsonb not null check (jsonb_typeof(workout_snapshot) = 'object'),
  shared_at timestamptz not null default now()
);
create index if not exists workout_shares_recipient_idx on public.workout_shares (recipient_id, shared_at desc);
alter table public.workout_shares add column if not exists sender_label text not null default '';

-- Each completed run is a separate event, so repeated sessions retain their dates.
create table if not exists public.workout_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid references public.workout_plans(id) on delete set null,
  workout_snapshot jsonb not null check (jsonb_typeof(workout_snapshot) = 'object'),
  completed_at timestamptz not null default now()
);
create index if not exists workout_completions_owner_date_idx on public.workout_completions (user_id, completed_at desc);
create index if not exists workout_completions_workout_idx on public.workout_completions (workout_id, completed_at desc);

alter table public.workout_shares enable row level security;
alter table public.workout_completions enable row level security;
drop policy if exists "Share sender or receiver can read" on public.workout_shares;
create policy "Share sender or receiver can read" on public.workout_shares for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
drop policy if exists "Owner can send a workout" on public.workout_shares;
create policy "Owner can send a workout" on public.workout_shares for insert to authenticated with check (
  auth.uid() = sender_id and exists (
    select 1 from public.workout_plans p where p.id = workout_id and p.user_id = auth.uid()
  )
);
drop policy if exists "Owner or public-plan visitors can read completions" on public.workout_completions;
create policy "Owner or public-plan visitors can read completions" on public.workout_completions for select using (
  auth.uid() = user_id or exists (
    select 1 from public.workout_plans p where p.id = workout_id and p.visibility = 'public'
  )
);
drop policy if exists "Owner records their completed workout" on public.workout_completions;
create policy "Owner records their completed workout" on public.workout_completions for insert to authenticated with check (
  auth.uid() = user_id and (workout_id is null or exists (
    select 1 from public.workout_plans p where p.id = workout_id and p.user_id = auth.uid()
  ))
);

grant select on public.profiles, public.workout_plans, public.workout_shares, public.workout_completions to anon, authenticated;
grant insert, update, delete on public.workout_plans to authenticated;
grant insert, update on public.profiles to authenticated;
grant select, insert on public.workout_shares to authenticated;
grant select, insert on public.workout_completions to authenticated;

-- Public plans are readable by everyone; private plans remain owner-only through RLS.

