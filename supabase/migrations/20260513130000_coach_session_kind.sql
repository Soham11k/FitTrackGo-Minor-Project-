-- Distinguish rep-based strength coach vs mobility / ROM holds
ALTER TABLE coach_sessions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'rep';

COMMENT ON COLUMN coach_sessions.kind IS 'rep | rom — strength reps vs mobility hold sessions';
