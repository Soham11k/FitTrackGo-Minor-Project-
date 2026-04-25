# Database Setup - Fix "Could not find table 'profiles'"

## Quick Fix (2 minutes)

The error means your Supabase database tables haven't been created yet. Here's how to fix it:

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard:
   **https://app.supabase.com/project/extblftryftjjitcetvq/sql/new**

2. Or navigate manually:
   - Go to https://app.supabase.com
   - Select your project
   - Click **SQL Editor** in the left sidebar
   - Click **New Query**

### Step 2: Run the Schema

1. Open the file `supabase/schema.sql` in your project
2. **Copy the ENTIRE contents** (all 181 lines)
3. Paste into the Supabase SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)
5. You should see: **"Success. No rows returned"**

### Step 3: Verify Tables Were Created

1. In Supabase dashboard, go to **Table Editor**
2. You should see these tables:
   - ✅ `profiles`
   - ✅ `workouts`
   - ✅ `runs`
   - ✅ `coach_sessions`
   - ✅ `favorites`

### Step 4: Refresh Your App

1. Go back to your app
2. Refresh the page
3. The error should be gone!

## What the Schema Creates

- **profiles** - User profile data (name, level, goals, streak)
- **workouts** - Workout history
- **runs** - Running sessions
- **coach_sessions** - AI Coach workout sessions
- **favorites** - Favorite exercises
- **Row Level Security (RLS)** - Security policies so users can only see their own data
- **Triggers** - Auto-create profile when user signs up

## Troubleshooting

### Error: `PGRST204: Could not find the 'effective_reps' column of 'coach_sessions'`

Your `coach_sessions` table was created before **competition / form-weighted** columns were added. Add them in the SQL Editor (safe to run more than once):

1. Open **SQL Editor** → New query.
2. Paste and run:

```sql
ALTER TABLE coach_sessions
  ADD COLUMN IF NOT EXISTS effective_reps REAL,
  ADD COLUMN IF NOT EXISTS verified_movement BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS face_verified_session BOOLEAN DEFAULT FALSE;
```

3. Optionally run **Database** → **Schema** → reload, or wait a minute for PostgREST to refresh its cache.

The same SQL lives in `supabase/migrations/20250301000000_coach_session_competition.sql`.

### Error: "relation already exists"
- Some tables already exist - that's okay!
- The schema uses `CREATE TABLE IF NOT EXISTS` so it's safe to run again
- Just continue - it will skip existing tables

### Error: "permission denied"
- Make sure you're logged into Supabase
- Make sure you're in the correct project
- Try refreshing the SQL Editor page

### Still seeing errors?
1. Check that you copied the ENTIRE schema.sql file
2. Make sure you clicked "Run" after pasting
3. Check the Supabase SQL Editor for any error messages
4. Try running the schema again (it's safe to run multiple times)

## Direct SQL Editor Link

**Quick link to SQL Editor:**
https://app.supabase.com/project/extblftryftjjitcetvq/sql/new

## Need Help?

If you're still having issues:
1. Check the Supabase SQL Editor for error messages
2. Make sure your `.env.local` has the correct Supabase URL and keys
3. Verify you're logged into the correct Supabase project
