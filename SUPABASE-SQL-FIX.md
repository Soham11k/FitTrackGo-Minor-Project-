# Fix SQL Syntax Error - Step by Step Guide

## The Problem
You're getting: `ERROR: 42601: syntax error at or near "rollback"`

This usually happens when:
1. Extra text was copied (like transaction statements)
2. The SQL Editor added something automatically
3. Copy/paste included hidden characters

## ✅ Solution: Use the Clean Schema File

I've created a clean version: `supabase/schema-clean.sql`

### Method 1: Copy from Clean File (Recommended)

1. **Open the clean file**:
   - Open `supabase/schema-clean.sql` in your project
   - Select ALL (Cmd+A / Ctrl+A)
   - Copy (Cmd+C / Ctrl+C)

2. **Paste in Supabase**:
   - Go to: https://app.supabase.com/project/extblftryftjjitcetvq/sql/new
   - Click in the editor
   - Paste (Cmd+V / Ctrl+V)
   - **Make sure there's nothing else in the editor** (no "BEGIN", "ROLLBACK", etc.)

3. **Run**:
   - Click **Run** button (or Cmd+Enter / Ctrl+Enter)
   - Should see: "Success. No rows returned"

### Method 2: Run in Parts (If Method 1 Fails)

If you still get errors, run these parts separately:

#### Part 1: Tables
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

CREATE TABLE IF NOT EXISTS coach_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise TEXT NOT NULL,
  reps INTEGER NOT NULL,
  score INTEGER NOT NULL,
  rep_scores INTEGER[] DEFAULT '{}',
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exercise_id)
);
```

#### Part 2: Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_completed_at ON workouts(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_user_id ON runs(user_id);
CREATE INDEX IF NOT EXISTS idx_runs_completed_at ON runs(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_sessions_user_id ON coach_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_sessions_completed_at ON coach_sessions(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
```

#### Part 3: RLS
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
```

#### Part 4: Policies
```sql
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own workouts" ON workouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workouts" ON workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own workouts" ON workouts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own runs" ON runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own runs" ON runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own runs" ON runs FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own coach sessions" ON coach_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own coach sessions" ON coach_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own coach sessions" ON coach_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own favorites" ON favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON favorites FOR DELETE USING (auth.uid() = user_id);
```

#### Part 5: Functions & Triggers
```sql
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## ⚠️ Important Notes

1. **Clear the editor first**: Make sure there's nothing else in the SQL Editor before pasting
2. **No transaction statements**: Don't add `BEGIN;` or `COMMIT;` - Supabase handles this automatically
3. **One statement at a time**: If running in parts, run each part separately
4. **Check for errors**: If you see "relation already exists", that's OK - it means the table already exists

## ✅ Verify It Worked

After running, check:
1. Go to **Table Editor**: https://app.supabase.com/project/extblftryftjjitcetvq/editor
2. You should see these tables:
   - ✅ `profiles`
   - ✅ `workouts`
   - ✅ `runs`
   - ✅ `coach_sessions`
   - ✅ `favorites`

## 🔗 Quick Links

- **SQL Editor**: https://app.supabase.com/project/extblftryftjjitcetvq/sql/new
- **Table Editor**: https://app.supabase.com/project/extblftryftjjitcetvq/editor
