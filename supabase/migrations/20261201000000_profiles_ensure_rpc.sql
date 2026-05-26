-- Client-side upserts against `profiles` can fail with 42501 (RLS) when the REST
-- layer sees no JWT (`auth.uid()` null) despite `auth.getUser()` succeeding, or when
-- local policies drift. SECURITY DEFINER + explicit uid guard matches `handle_new_user`.

CREATE OR REPLACE FUNCTION public.ensure_own_profile_bootstrap(
  p_name text,
  p_level text,
  p_goals text[],
  p_join_date date,
  p_onboarded boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.profiles (
    id,
    name,
    level,
    goals,
    join_date,
    onboarded
  )
  VALUES (
    uid,
    COALESCE(NULLIF(trim(p_name), ''), 'Athlete'),
    COALESCE(NULLIF(trim(p_level), ''), 'beginner'),
    COALESCE(p_goals, '{}'),
    COALESCE(p_join_date, CURRENT_DATE),
    COALESCE(p_onboarded, false)
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_own_profile_name(p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  n text := NULLIF(trim(p_name), '');
BEGIN
  IF uid IS NULL OR n IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.profiles (id, name, join_date)
  VALUES (uid, n, CURRENT_DATE)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_own_profile_bootstrap(text, text, text[], date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_own_profile_bootstrap(text, text, text[], date, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.sync_own_profile_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_own_profile_name(text) TO authenticated;
