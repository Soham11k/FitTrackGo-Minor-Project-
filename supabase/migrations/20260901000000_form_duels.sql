-- Async form duels (Arena): shared state for cross-device join and scoring.

CREATE TABLE IF NOT EXISTS form_duels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  exercise TEXT NOT NULL,
  challenger_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  challenger_name TEXT NOT NULL,
  opponent_name TEXT,
  challenger_score DOUBLE PRECISION,
  opponent_score DOUBLE PRECISION,
  settled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT form_duels_code_format CHECK (char_length(code) >= 4 AND char_length(code) <= 8),
  CONSTRAINT form_duels_code_upper CHECK (code = upper(code))
);

CREATE INDEX IF NOT EXISTS idx_form_duels_challenger ON form_duels(challenger_user_id);
CREATE INDEX IF NOT EXISTS idx_form_duels_opponent ON form_duels(opponent_user_id);
CREATE INDEX IF NOT EXISTS idx_form_duels_created ON form_duels(created_at DESC);

ALTER TABLE form_duels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "form_duels_select_participant"
    ON form_duels FOR SELECT
    USING (
      auth.uid() = challenger_user_id
      OR auth.uid() = opponent_user_id
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "form_duels_insert_challenger"
    ON form_duels FOR INSERT
    WITH CHECK (auth.uid() = challenger_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Join by code (atomic); avoids permissive SELECT for strangers.
CREATE OR REPLACE FUNCTION public.join_form_duel(p_code text, p_opponent_name text)
RETURNS public.form_duels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rec public.form_duels;
  norm text := upper(trim(p_code));
  opp_name text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF norm IS NULL OR norm = '' THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;
  opp_name := COALESCE(nullif(trim(p_opponent_name), ''), 'Opponent');

  UPDATE public.form_duels d
  SET
    opponent_user_id = uid,
    opponent_name = opp_name,
    updated_at = NOW()
  WHERE d.code = norm
    AND d.opponent_user_id IS NULL
    AND d.challenger_user_id <> uid
  RETURNING * INTO rec;

  IF FOUND THEN
    RETURN rec;
  END IF;

  SELECT * INTO rec FROM public.form_duels WHERE code = norm LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;
  IF rec.challenger_user_id = uid THEN
    RAISE EXCEPTION 'own_duel';
  END IF;
  IF rec.opponent_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'duel_full';
  END IF;
  RAISE EXCEPTION 'join_failed';
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_form_duel_score(p_duel_id uuid, p_composite_score double precision)
RETURNS public.form_duels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.form_duels;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_composite_score IS NULL OR p_composite_score < 0 THEN
    RAISE EXCEPTION 'invalid_score';
  END IF;

  UPDATE public.form_duels d
  SET
    challenger_score = CASE WHEN d.challenger_user_id = uid THEN p_composite_score ELSE d.challenger_score END,
    opponent_score = CASE WHEN d.opponent_user_id = uid THEN p_composite_score ELSE d.opponent_score END,
    settled = (
      (CASE WHEN d.challenger_user_id = uid THEN p_composite_score ELSE d.challenger_score END) IS NOT NULL
      AND (CASE WHEN d.opponent_user_id = uid THEN p_composite_score ELSE d.opponent_score END) IS NOT NULL
    ),
    updated_at = NOW()
  WHERE d.id = p_duel_id
    AND (d.challenger_user_id = uid OR d.opponent_user_id = uid)
  RETURNING * INTO r;

  IF NOT FOUND THEN
    SELECT * INTO r FROM public.form_duels WHERE id = p_duel_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found';
    END IF;
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.join_form_duel(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_form_duel(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_form_duel_score(uuid, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_form_duel_score(uuid, double precision) TO authenticated;
