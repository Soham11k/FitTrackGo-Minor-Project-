-- AI-generated post-set clip reviews. One row per coach session.
create table if not exists public.coach_clip_reviews (
  session_id uuid primary key references public.coach_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text not null default '',
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.coach_clip_reviews enable row level security;

create policy "owner_select_clip_reviews"
  on public.coach_clip_reviews
  for select
  using (auth.uid() = user_id);

create policy "owner_insert_clip_reviews"
  on public.coach_clip_reviews
  for insert
  with check (auth.uid() = user_id);

create policy "owner_update_clip_reviews"
  on public.coach_clip_reviews
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owner_delete_clip_reviews"
  on public.coach_clip_reviews
  for delete
  using (auth.uid() = user_id);

comment on table public.coach_clip_reviews is 'Post-set AI vision review for the per-session WebM clip.';
