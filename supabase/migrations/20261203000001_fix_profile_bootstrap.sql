-- Harden profile bootstrap: idempotent auth trigger + SECURITY DEFINER RPC grants.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, join_date)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'Athlete'
    ),
    CURRENT_DATE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

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

REVOKE ALL ON FUNCTION public.ensure_own_profile_bootstrap(text, text, text[], date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_own_profile_bootstrap(text, text, text[], date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_own_profile_bootstrap(text, text, text[], date, boolean) TO service_role;
