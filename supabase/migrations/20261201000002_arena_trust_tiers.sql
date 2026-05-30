-- Arena trust tiers: link duel submissions to coach sessions for server-side score verification.

ALTER TABLE form_duels
  ADD COLUMN IF NOT EXISTS challenger_session_id UUID REFERENCES coach_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opponent_session_id   UUID REFERENCES coach_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS challenger_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS opponent_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS challenger_face_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS opponent_face_verified   BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN form_duels.challenger_session_id IS 'coach_sessions row that generated the challenger score.';
COMMENT ON COLUMN form_duels.opponent_session_id   IS 'coach_sessions row that generated the opponent score.';
COMMENT ON COLUMN form_duels.challenger_verified    IS 'True when challenger submitted a verified-movement session.';
COMMENT ON COLUMN form_duels.opponent_verified      IS 'True when opponent submitted a verified-movement session.';
COMMENT ON COLUMN form_duels.challenger_face_verified IS 'True when challenger session was face-verified.';
COMMENT ON COLUMN form_duels.opponent_face_verified   IS 'True when opponent session was face-verified.';

-- Replace the existing submit RPC with a version that accepts an optional session_id and
-- stores verification flags sourced from that session.
CREATE OR REPLACE FUNCTION public.submit_form_duel_score(
  p_duel_id        uuid,
  p_composite_score double precision,
  p_session_id      uuid DEFAULT NULL
)
RETURNS public.form_duels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid          uuid := auth.uid();
  r            public.form_duels;
  sess_verified     boolean := false;
  sess_face_verified boolean := false;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_composite_score IS NULL OR p_composite_score < 0 THEN
    RAISE EXCEPTION 'invalid_score';
  END IF;

  -- Fetch verification flags from the linked coach session (if provided).
  IF p_session_id IS NOT NULL THEN
    SELECT
      COALESCE(verified_movement, false),
      COALESCE(face_verified_session, false)
    INTO sess_verified, sess_face_verified
    FROM public.coach_sessions
    WHERE id = p_session_id AND user_id = uid;
  END IF;

  UPDATE public.form_duels d
  SET
    challenger_score       = CASE WHEN d.challenger_user_id = uid THEN p_composite_score   ELSE d.challenger_score        END,
    opponent_score         = CASE WHEN d.opponent_user_id   = uid THEN p_composite_score   ELSE d.opponent_score          END,
    challenger_session_id  = CASE WHEN d.challenger_user_id = uid THEN p_session_id        ELSE d.challenger_session_id   END,
    opponent_session_id    = CASE WHEN d.opponent_user_id   = uid THEN p_session_id        ELSE d.opponent_session_id     END,
    challenger_verified    = CASE WHEN d.challenger_user_id = uid THEN sess_verified        ELSE d.challenger_verified     END,
    opponent_verified      = CASE WHEN d.opponent_user_id   = uid THEN sess_verified        ELSE d.opponent_verified       END,
    challenger_face_verified = CASE WHEN d.challenger_user_id = uid THEN sess_face_verified  ELSE d.challenger_face_verified END,
    opponent_face_verified   = CASE WHEN d.opponent_user_id   = uid THEN sess_face_verified  ELSE d.opponent_face_verified   END,
    settled = (
      (CASE WHEN d.challenger_user_id = uid THEN p_composite_score ELSE d.challenger_score END) IS NOT NULL
      AND
      (CASE WHEN d.opponent_user_id   = uid THEN p_composite_score ELSE d.opponent_score   END) IS NOT NULL
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

REVOKE ALL ON FUNCTION public.submit_form_duel_score(uuid, double precision, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_form_duel_score(uuid, double precision, uuid) TO authenticated;
