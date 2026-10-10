-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  level TEXT DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  goals TEXT[] DEFAULT '{}',
  join_date DATE DEFAULT CURRENT_DATE,
  onboarded BOOLEAN DEFAULT false,
  streak INTEGER DEFAULT 0,
  last_active_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workouts table
CREATE TABLE IF NOT EXISTS workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  duration INTEGER NOT NULL,
  calories INTEGER NOT NULL,
  exercise_count INTEGER NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Runs table
CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  distance DECIMAL(10, 2) NOT NULL,
  duration INTEGER NOT NULL,
  pace TEXT NOT NULL,
  calories INTEGER NOT NULL,
  path JSONB,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Coach sessions table
CREATE TABLE IF NOT EXISTS coach_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise TEXT NOT NULL,
  reps INTEGER NOT NULL,
  score INTEGER NOT NULL,
  rep_scores INTEGER[] DEFAULT '{}',
  effective_reps REAL,
  verified_movement BOOLEAN DEFAULT FALSE,
  face_verified_session BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exercise_id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_completed_at ON workouts(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_user_id ON runs(user_id);
CREATE INDEX IF NOT EXISTS idx_runs_completed_at ON runs(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_sessions_user_id ON coach_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_sessions_completed_at ON coach_sessions(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);

-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Workouts policies
CREATE POLICY "Users can view own workouts"
  ON workouts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workouts"
  ON workouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own workouts"
  ON workouts FOR DELETE
  USING (auth.uid() = user_id);

-- Runs policies
CREATE POLICY "Users can view own runs"
  ON runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own runs"
  ON runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own runs"
  ON runs FOR DELETE
  USING (auth.uid() = user_id);

-- Coach sessions policies
CREATE POLICY "Users can view own coach sessions"
  ON coach_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own coach sessions"
  ON coach_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own coach sessions"
  ON coach_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Favorites policies
CREATE POLICY "Users can view own favorites"
  ON favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON favorites FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, join_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'Athlete'),
    CURRENT_DATE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Wearables (Fitbit Phase 1)
CREATE TABLE IF NOT EXISTS wearable_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('fitbit', 'google_fit', 'apple_health', 'garmin')),
  external_user_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT NOT NULL DEFAULT '',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_wearable_connections_user_id ON wearable_connections(user_id);

CREATE TABLE IF NOT EXISTS wearable_daily_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('fitbit', 'google_fit', 'apple_health', 'garmin')),
  metric_date DATE NOT NULL,
  resting_heart_rate INTEGER,
  spo2_avg_pct NUMERIC(6, 2),
  spo2_min_pct NUMERIC(6, 2),
  spo2_max_pct NUMERIC(6, 2),
  steps INTEGER,
  avg_hr INTEGER,
  sleep_min INTEGER,
  source TEXT,
  ingested_at TIMESTAMPTZ,
  extra JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_wearable_daily_metrics_user_date
  ON wearable_daily_metrics(user_id, provider, metric_date DESC);

ALTER TABLE wearable_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE wearable_daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_wearable_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_wearable_connections_updated_at ON wearable_connections;
CREATE TRIGGER update_wearable_connections_updated_at
  BEFORE UPDATE ON wearable_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_wearable_updated_at();

DROP TRIGGER IF EXISTS update_wearable_daily_metrics_updated_at ON wearable_daily_metrics;
CREATE TRIGGER update_wearable_daily_metrics_updated_at
  BEFORE UPDATE ON wearable_daily_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_wearable_updated_at();

ALTER TABLE wearable_connections
  DROP CONSTRAINT IF EXISTS wearable_connections_provider_check;
ALTER TABLE wearable_connections
  ADD CONSTRAINT wearable_connections_provider_check
  CHECK (provider IN ('fitbit', 'google_fit', 'apple_health', 'garmin'));

ALTER TABLE wearable_daily_metrics
  DROP CONSTRAINT IF EXISTS wearable_daily_metrics_provider_check;
ALTER TABLE wearable_daily_metrics
  ADD CONSTRAINT wearable_daily_metrics_provider_check
  CHECK (provider IN ('fitbit', 'google_fit', 'apple_health', 'garmin'));

ALTER TABLE wearable_daily_metrics
  ADD COLUMN IF NOT EXISTS steps INTEGER,
  ADD COLUMN IF NOT EXISTS avg_hr INTEGER,
  ADD COLUMN IF NOT EXISTS sleep_min INTEGER,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ;
