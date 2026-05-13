-- Body weight (kg) + unit preference on profiles. Optional.
alter table public.profiles
  add column if not exists body_weight_kg numeric,
  add column if not exists weight_unit text default 'kg'
    check (weight_unit in ('kg', 'lb'));

comment on column public.profiles.body_weight_kg is 'User body weight in kilograms (optional).';
comment on column public.profiles.weight_unit is 'Preferred display unit for weights: kg or lb.';
