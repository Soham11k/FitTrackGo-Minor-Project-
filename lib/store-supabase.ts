import { createClient } from '@/lib/supabase/client'
import type { UserProfile, WorkoutRecord, RunRecord, CoachRecord } from './store'

// Use singleton client instance to prevent lock conflicts
const supabase = createClient()

// Helper function to retry with exponential backoff for lock timeouts
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 100
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      const isLockError = error?.message?.includes('LockManager') || 
                         error?.message?.includes('lock') ||
                         error?.message?.includes('timeout')
      
      if (isLockError && i < maxRetries - 1) {
        // Wait with exponential backoff before retrying
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)))
        continue
      }
      throw error
    }
  }
  throw new Error('Max retries exceeded')
}

// Profile functions
export async function getProfile(): Promise<UserProfile> {
  return retryWithBackoff(async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) throw new Error(`Authentication error: ${authError.message}`)
    if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // If profile doesn't exist (PGRST116), create it
  if (error && error.code === 'PGRST116') {
    // Profile doesn't exist, create it
    const defaultName = user.user_metadata?.name || 
                       user.user_metadata?.full_name ||
                       user.user_metadata?.display_name ||
                       user.email?.split('@')[0] ||
                       'Athlete'
    
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        name: defaultName,
        level: 'beginner',
        goals: [],
        join_date: new Date().toISOString().split('T')[0],
        onboarded: false,
      })

    if (insertError) {
      console.error('Failed to create profile:', insertError)
      throw new Error(`Failed to create profile: ${insertError.message}`)
    }

    // Return the newly created profile
    return {
      name: defaultName,
      level: 'beginner',
      goals: [],
      joinDate: new Date().toISOString().split('T')[0],
      onboarded: false,
    }
  }

  // Other errors
  if (error) {
    console.error('Profile fetch error:', error)
    throw new Error(`Failed to load profile: ${error.message}`)
  }

    // Return existing profile
    return {
      name: data?.name || '',
      level: (data?.level as UserProfile['level']) || 'beginner',
      goals: data?.goals || [],
      joinDate: data?.join_date || new Date().toISOString().split('T')[0],
      onboarded: data?.onboarded || false,
    }
  })
}

export async function saveProfile(patch: Partial<UserProfile>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const updates: any = {}
  if (patch.name !== undefined) updates.name = patch.name
  if (patch.level !== undefined) updates.level = patch.level
  if (patch.goals !== undefined) updates.goals = patch.goals
  if (patch.onboarded !== undefined) updates.onboarded = patch.onboarded

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, ...updates }, { onConflict: 'id' })

  if (error) throw error
}

export async function refreshStreak(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const today = new Date().toISOString().split('T')[0]
  const { data: profile } = await supabase
    .from('profiles')
    .select('streak, last_active_date')
    .eq('id', user.id)
    .single()

  if (!profile) return 0

  if (profile.last_active_date === today) return profile.streak || 0

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
  const newStreak = profile.last_active_date === yesterday ? (profile.streak || 0) + 1 : 1

  await supabase
    .from('profiles')
    .update({ streak: newStreak, last_active_date: today })
    .eq('id', user.id)

  return newStreak
}

export async function getStreak(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { data } = await supabase
    .from('profiles')
    .select('streak')
    .eq('id', user.id)
    .single()

  return data?.streak || 0
}

// Workout functions
export async function addWorkout(r: Omit<WorkoutRecord, 'id' | 'completedAt'>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('workouts')
    .insert({
      user_id: user.id,
      title: r.title,
      category: r.category,
      duration: r.duration,
      calories: r.calories,
      exercise_count: r.exerciseCount,
    })

  if (error) throw error
  await refreshStreak()
}

export async function getWorkouts(): Promise<WorkoutRecord[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return []

  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false })

  if (error) {
    console.error('Error fetching workouts:', error)
    return []
  }

  return (data || []).map((w) => ({
    id: w.id,
    title: w.title,
    category: w.category,
    duration: w.duration || 0,
    calories: w.calories || 0,
    exerciseCount: w.exercise_count || 0,
    completedAt: w.completed_at,
  }))
}

// Run functions
export async function addRun(r: Omit<RunRecord, 'id' | 'completedAt'>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('runs')
    .insert({
      user_id: user.id,
      distance: r.distance,
      duration: r.duration,
      pace: r.pace,
      calories: r.calories,
      path: r.path,
    })

  if (error) throw error
  await refreshStreak()
}

export async function getRuns(): Promise<RunRecord[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return []

  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false })

  if (error) {
    console.error('Error fetching runs:', error)
    return []
  }

  return (data || []).map((r) => ({
    id: r.id,
    distance: parseFloat(r.distance || 0),
    duration: r.duration || 0,
    pace: r.pace || '0:00',
    calories: r.calories || 0,
    path: r.path || [],
    completedAt: r.completed_at,
  }))
}

// Coach session functions
export async function addCoachSession(r: Omit<CoachRecord, 'id' | 'completedAt'>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('coach_sessions')
    .insert({
      user_id: user.id,
      exercise: r.exercise,
      reps: r.reps,
      score: r.score,
      rep_scores: r.repScores,
    })

  if (error) throw error
  await refreshStreak()
}

export async function getCoachSessions(): Promise<CoachRecord[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return []

  const { data, error } = await supabase
    .from('coach_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false })

  if (error) {
    console.error('Error fetching coach sessions:', error)
    return []
  }

  return (data || []).map((c) => ({
    id: c.id,
    exercise: c.exercise,
    reps: c.reps || 0,
    score: c.score || 0,
    repScores: c.rep_scores || [],
    completedAt: c.completed_at,
  }))
}

// Favorites functions
export async function toggleFavorite(exerciseId: number) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('exercise_id', exerciseId)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: user.id, exercise_id: exerciseId })
    if (error) throw error
  }
}

export async function getFavorites(): Promise<number[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('favorites')
    .select('exercise_id')
    .eq('user_id', user.id)

  if (error) throw error
  return (data || []).map((f) => f.exercise_id)
}

// Stats functions
export async function getTotalStats() {
  try {
    const workouts = await getWorkouts()
    const runs = await getRuns()
    const coachSessions = await getCoachSessions()
    const streak = await getStreak()

    return {
      totalWorkouts: workouts.length + coachSessions.length,
      totalRuns: runs.length,
      totalCalories: [...workouts.map((w) => w.calories || 0), ...runs.map((r) => r.calories || 0)].reduce((a, b) => a + b, 0),
      totalDistance: runs.reduce((a, r) => a + (r.distance || 0), 0),
      totalActiveMinutes: workouts.reduce((a, w) => a + Math.round((w.duration || 0) / 60), 0) + runs.reduce((a, r) => a + Math.round((r.duration || 0) / 60), 0),
      streak: streak || 0,
    }
  } catch (error) {
    console.error('Error getting total stats:', error)
    // Return default stats on error
    return {
      totalWorkouts: 0,
      totalRuns: 0,
      totalCalories: 0,
      totalDistance: 0,
      totalActiveMinutes: 0,
      streak: 0,
    }
  }
}

export async function getWeeklyActivity() {
  try {
    const workouts = await getWorkouts()
    const runs = await getRuns()
    const coachSessions = await getCoachSessions()
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    monday.setHours(0, 0, 0, 0)

    return labels.map((day, i) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      const ds = date.toISOString().split('T')[0]
      const all = [...workouts, ...runs, ...coachSessions]
      const count = all.filter((r) => r.completedAt?.startsWith(ds)).length
      return { day, count, active: count > 0 }
    })
  } catch (error) {
    console.error('Error getting weekly activity:', error)
    // Return empty week on error
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
      day,
      count: 0,
      active: false,
    }))
  }
}

export async function getRecentActivity(limit = 10) {
  const workouts = await getWorkouts()
  const runs = await getRuns()
  const coachSessions = await getCoachSessions()

  const all: { type: string; title: string; detail: string; time: string }[] = [
    ...workouts.map((w) => ({ type: 'workout', title: w.title, detail: `${w.exerciseCount} exercises · ${Math.round(w.duration / 60)}min`, time: w.completedAt })),
    ...runs.map((r) => ({ type: 'run', title: 'Run', detail: `${r.distance.toFixed(2)} km · ${r.pace} pace`, time: r.completedAt })),
    ...coachSessions.map((c) => ({ type: 'coach', title: `AI: ${c.exercise}`, detail: `${c.reps} reps · ${c.score}%`, time: c.completedAt })),
  ]
  all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  return all.slice(0, limit)
}

export async function getTodaySummary() {
  const workouts = await getWorkouts()
  const runs = await getRuns()
  const coachSessions = await getCoachSessions()
  const today = new Date().toISOString().split('T')[0]

  const todayWorkouts = workouts.filter((w) => w.completedAt.startsWith(today))
  const todayRuns = runs.filter((r) => r.completedAt.startsWith(today))
  const todayCoach = coachSessions.filter((c) => c.completedAt.startsWith(today))

  return {
    workouts: todayWorkouts.length,
    runs: todayRuns.length,
    coachSessions: todayCoach.length,
    calories: [...todayWorkouts, ...todayRuns].reduce((a, x) => a + x.calories, 0),
    activeMinutes: [...todayWorkouts, ...todayRuns, ...todayCoach].reduce((a, x) => a + Math.round(x.duration / 60), 0) + todayCoach.length * 3,
  }
}

export async function getLastDoneExerciseIds(): Promise<number[]> {
  const workouts = await getWorkouts()
  const titles = new Set(workouts.map((w) => w.title))
  return [] // map title to exercise id if you have a mapping
}
