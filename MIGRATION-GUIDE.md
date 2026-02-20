# Migration Guide: localStorage → Supabase

This guide helps you migrate from localStorage-based storage to Supabase cloud storage.

## Quick Migration Steps

### 1. Update All Store Imports

Find and replace in all component files:

**Before:**
```typescript
import { getProfile, saveProfile, ... } from "@/lib/store"
```

**After:**
```typescript
import { getProfile, saveProfile, ... } from "@/lib/store-supabase"
```

### Files to Update:
- `components/dashboard.tsx`
- `components/exercise-library.tsx`
- `components/run-tracker.tsx`
- `components/ai-coach.tsx`
- `components/profile-screen.tsx`
- `components/workout-history.tsx`

### 2. Update Component Code

All store functions are now async! Update your components:

**Before:**
```typescript
const profile = useMemo(() => getProfile(), [])
const stats = useMemo(() => getTotalStats(), [])
```

**After:**
```typescript
const [profile, setProfile] = useState<UserProfile | null>(null)
const [stats, setStats] = useState<any>(null)

useEffect(() => {
  async function load() {
    const p = await getProfile()
    const s = await getTotalStats()
    setProfile(p)
    setStats(s)
  }
  load()
}, [])
```

### 3. Update Function Calls

**Before:**
```typescript
addWorkout({ title: "...", ... })
```

**After:**
```typescript
await addWorkout({ title: "...", ... })
```

### 4. Handle Errors

Add error handling for network/auth errors:

```typescript
try {
  await addWorkout({ ... })
  toast.success("Workout saved!")
} catch (error) {
  toast.error("Failed to save workout. Please try again.")
  console.error(error)
}
```

### 5. Update Auth Flow

**Before:**
```typescript
const handleLogin = () => {
  saveProfile({ name: "User", onboarded: true })
  onLogin()
}
```

**After:**
```typescript
const handleLogin = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await saveProfile({ name: user.user_metadata.name || "User", onboarded: true })
      onLogin()
    }
  } catch (error) {
    toast.error("Failed to load profile")
  }
}
```

## Migration Script (Optional)

If you want to migrate existing localStorage data to Supabase:

```typescript
// scripts/migrate-localstorage.ts
import { createClient } from '@/lib/supabase/client'

async function migrate() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('Not authenticated')
    return
  }

  // Load from localStorage
  const localData = JSON.parse(localStorage.getItem('fittrackgo_data') || '{}')

  // Migrate workouts
  for (const workout of localData.workouts || []) {
    await supabase.from('workouts').insert({
      user_id: user.id,
      title: workout.title,
      category: workout.category,
      duration: workout.duration,
      calories: workout.calories,
      exercise_count: workout.exerciseCount,
      completed_at: workout.completedAt,
    })
  }

  // Migrate runs
  for (const run of localData.runs || []) {
    await supabase.from('runs').insert({
      user_id: user.id,
      distance: run.distance,
      duration: run.duration,
      pace: run.pace,
      calories: run.calories,
      path: run.path,
      completed_at: run.completedAt,
    })
  }

  // Migrate coach sessions
  for (const session of localData.coachSessions || []) {
    await supabase.from('coach_sessions').insert({
      user_id: user.id,
      exercise: session.exercise,
      reps: session.reps,
      score: session.score,
      rep_scores: session.repScores,
      completed_at: session.completedAt,
    })
  }

  // Migrate favorites
  for (const favId of localData.favorites || []) {
    await supabase.from('favorites').insert({
      user_id: user.id,
      exercise_id: favId,
    })
  }

  // Migrate profile
  if (localData.profile) {
    await supabase.from('profiles').upsert({
      id: user.id,
      name: localData.profile.name,
      level: localData.profile.level,
      goals: localData.profile.goals,
      join_date: localData.profile.joinDate,
      onboarded: localData.profile.onboarded,
      streak: localData.streak || 0,
      last_active_date: localData.lastActiveDate || null,
    })
  }

  console.log('Migration complete!')
}

migrate()
```

## Testing Checklist

- [ ] Sign up with email/password works
- [ ] Sign in with email/password works
- [ ] Google OAuth works (if configured)
- [ ] Apple OAuth works (if configured)
- [ ] Profile loads correctly
- [ ] Workouts save and load
- [ ] Runs save and load
- [ ] AI Coach sessions save and load
- [ ] Favorites work
- [ ] Stats calculate correctly
- [ ] Logout works
- [ ] Data persists across sessions
- [ ] Data syncs across devices

## Rollback Plan

If you need to rollback to localStorage:

1. Change imports back to `@/lib/store`
2. Remove Supabase environment variables
3. Remove middleware.ts (or comment it out)
4. Your localStorage data should still be there

## Need Help?

- Check Supabase logs: **Logs** → **Postgres Logs** or **Auth Logs**
- Check browser console for errors
- Verify RLS policies are correct
- Ensure user is authenticated before calling store functions
