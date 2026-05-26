CREATE TABLE IF NOT EXISTS user_clip_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  wrapped_key bytea NOT NULL,
  salt bytea NOT NULL,
  algo text NOT NULL DEFAULT 'pbkdf2-sha256-aes-gcm-256',
  iterations integer NOT NULL DEFAULT 600000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_clip_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_clip_keys_select_own" ON user_clip_keys;
CREATE POLICY "user_clip_keys_select_own"
  ON user_clip_keys FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_clip_keys_insert_own" ON user_clip_keys;
CREATE POLICY "user_clip_keys_insert_own"
  ON user_clip_keys FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_clip_keys_update_own" ON user_clip_keys;
CREATE POLICY "user_clip_keys_update_own"
  ON user_clip_keys FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE coach_clips ADD COLUMN IF NOT EXISTS encrypted text;

COMMENT ON TABLE user_clip_keys IS 'Passphrase-wrapped local clip AES key for cross-device recovery (zero-knowledge).';
