-- Phase 8: Training programs — programs, days, blocks, enrollments, adherence.

CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  weeks INTEGER NOT NULL CHECK (weeks BETWEEN 1 AND 52),
  level TEXT DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  hero_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS program_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  UNIQUE (program_id, day_index)
);

CREATE TABLE IF NOT EXISTS program_day_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_day_id UUID NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  sets INTEGER NOT NULL DEFAULT 3 CHECK (sets > 0),
  reps INTEGER,
  duration_sec INTEGER,
  rest_sec INTEGER NOT NULL DEFAULT 60
);
CREATE INDEX IF NOT EXISTS idx_blocks_by_day ON program_day_blocks(program_day_id, order_index);

CREATE TABLE IF NOT EXISTS user_program_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  current_day INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT TRUE,
  UNIQUE (user_id, program_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON user_program_enrollments(user_id) WHERE active;

CREATE TABLE IF NOT EXISTS program_adherence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES user_program_enrollments(id) ON DELETE CASCADE,
  program_day_id UUID NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  score INTEGER,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_adherence_enrollment ON program_adherence(enrollment_id, completed_at DESC);

-- Programs/days/blocks are public read (catalog), no writes from client.
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_day_blocks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "programs_read_all" ON programs FOR SELECT USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "program_days_read_all" ON program_days FOR SELECT USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "program_blocks_read_all" ON program_day_blocks FOR SELECT USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE user_program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_adherence ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "enroll_select_own" ON user_program_enrollments FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "enroll_insert_own" ON user_program_enrollments FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "enroll_update_own" ON user_program_enrollments FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "enroll_delete_own" ON user_program_enrollments FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Adherence: check that the enrollment is owned by the caller.
DO $$ BEGIN
  CREATE POLICY "adherence_select_own" ON program_adherence FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_program_enrollments e
      WHERE e.id = program_adherence.enrollment_id AND e.user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "adherence_insert_own" ON program_adherence FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_program_enrollments e
      WHERE e.id = program_adherence.enrollment_id AND e.user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
