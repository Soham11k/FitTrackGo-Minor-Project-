-- Form-weighted / verified movement fields (run in Supabase SQL editor if migrations not applied)
ALTER TABLE coach_sessions
  ADD COLUMN IF NOT EXISTS effective_reps REAL,
  ADD COLUMN IF NOT EXISTS verified_movement BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS face_verified_session BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN coach_sessions.effective_reps IS 'Form-weighted rep volume for fair leaderboards';
COMMENT ON COLUMN coach_sessions.verified_movement IS 'Session met minimum form threshold for verified tier';
COMMENT ON COLUMN coach_sessions.face_verified_session IS 'User had face enrollment and verified reps during session';
