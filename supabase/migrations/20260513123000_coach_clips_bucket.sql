-- Private clip uploads (opt-in from app when NEXT_PUBLIC_ENABLE_COACH_CLIPS=1)
INSERT INTO storage.buckets (id, name, public)
VALUES ('coach-clips', 'coach-clips', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS coach_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coach_sessions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  duration_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id)
);

ALTER TABLE coach_clips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_clips_select_own" ON coach_clips;
CREATE POLICY "coach_clips_select_own"
  ON coach_clips FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "coach_clips_insert_own" ON coach_clips;
CREATE POLICY "coach_clips_insert_own"
  ON coach_clips FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "coach_clips_delete_own" ON coach_clips;
CREATE POLICY "coach_clips_delete_own"
  ON coach_clips FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Storage: users may manage files under their user_id prefix
DROP POLICY IF EXISTS "coach_clips_storage_select" ON storage.objects;
CREATE POLICY "coach_clips_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'coach-clips'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "coach_clips_storage_insert" ON storage.objects;
CREATE POLICY "coach_clips_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'coach-clips'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "coach_clips_storage_update" ON storage.objects;
CREATE POLICY "coach_clips_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'coach-clips'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "coach_clips_storage_delete" ON storage.objects;
CREATE POLICY "coach_clips_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'coach-clips'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

COMMENT ON TABLE coach_clips IS 'Opt-in uploaded WebM coach session clips (see NEXT_PUBLIC_ENABLE_COACH_CLIPS)';
