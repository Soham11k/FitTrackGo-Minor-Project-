-- Per-set external load + total volume for AI Coach sessions.
alter table public.coach_sessions
  add column if not exists load_kg numeric,
  add column if not exists volume_kg numeric;

comment on column public.coach_sessions.load_kg is 'External load lifted on this set, in kilograms. NULL for bodyweight movements.';
comment on column public.coach_sessions.volume_kg is 'reps × load_kg cached at write time.';

create index if not exists coach_sessions_load_idx
  on public.coach_sessions(user_id, exercise, completed_at desc)
  where load_kg is not null;
