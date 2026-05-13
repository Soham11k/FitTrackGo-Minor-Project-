-- Per-rep bottom/top snapshots (joint angles + faults) for form reports & compare
ALTER TABLE coach_sessions
  ADD COLUMN IF NOT EXISTS rep_traces JSONB DEFAULT NULL;

COMMENT ON COLUMN coach_sessions.rep_traces IS 'Array of { rep, bottom: RepTrace, top: RepTrace } for form analysis';
