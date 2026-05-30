-- Motion DNA: 6-axis biomechanical fingerprint stored per coach session.
-- Computed client-side from rep traces; stored as JSONB for future analytics.

ALTER TABLE coach_sessions
  ADD COLUMN IF NOT EXISTS motion_dna JSONB;

COMMENT ON COLUMN coach_sessions.motion_dna IS
  'MotionDna object: {stability, range, tempo, symmetry, depth, consistency} — each 0..1.
   Computed by lib/coach-vision/motion-dna.ts on session finish.';
