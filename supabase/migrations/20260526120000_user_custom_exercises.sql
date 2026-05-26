-- User-authored custom exercises (FormSpec JSON generated in-app).
create table if not exists public.user_custom_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  spec_id text not null,
  display_name text not null,
  description text not null default '',
  form_spec jsonb not null,
  camera_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, spec_id)
);

create index if not exists user_custom_exercises_user_idx
  on public.user_custom_exercises (user_id, updated_at desc);

alter table public.user_custom_exercises enable row level security;

create policy "user_custom_exercises_select_own"
  on public.user_custom_exercises for select
  using (auth.uid() = user_id);

create policy "user_custom_exercises_insert_own"
  on public.user_custom_exercises for insert
  with check (auth.uid() = user_id);

create policy "user_custom_exercises_update_own"
  on public.user_custom_exercises for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_custom_exercises_delete_own"
  on public.user_custom_exercises for delete
  using (auth.uid() = user_id);

comment on table public.user_custom_exercises is 'Per-user FormSpec definitions for AI Coach custom movements';

-- Link coach sessions to catalog/custom spec id for replay and analysis.
alter table public.coach_sessions
  add column if not exists exercise_spec_id text;

comment on column public.coach_sessions.exercise_spec_id is 'FormSpec id (built-in or custom_*) used during the session';

create index if not exists coach_sessions_spec_idx
  on public.coach_sessions (user_id, exercise_spec_id)
  where exercise_spec_id is not null;
