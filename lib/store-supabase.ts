import { createClient } from '@/lib/supabase/client'
import type { UserProfile, WorkoutRecord, RunRecord, CoachRecord } from './store'
import { isNetworkError, offlineQueue } from './network-status'

// Use singleton client instance to prevent lock conflicts
const supabase = createClient()

// Small helper to avoid hammering auth.getUser in parallel and triggering browser locks
let cachedAuthUserPromise: Promise<any> | null = null
let cachedAuthUserAt = 0
const AUTH_USER_CACHE_MS = 15_000

async function getCachedAuthUser() {
  const now = Date.now()
  if (!cachedAuthUserPromise || now - cachedAuthUserAt > AUTH_USER_CACHE_MS) {
    cachedAuthUserAt = now
    cachedAuthUserPromise = retryWithBackoff(
      () => supabase.auth.getUser(),
      3,
      150
    )
  }
  return cachedAuthUserPromise
}

function toLocalDateStr(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function withNetworkHandling<T>(id: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (isNetworkError(error)) {
      offlineQueue.add(() => fn().then(() => {}), id)
      throw error
    }
    throw error
  }
}

/** Serialize any error to a readable string (Supabase errors often log as "{}" otherwise). */
export function formatErr(e: unknown): string {
  if (e == null) return 'Unknown error'
  if (typeof e === 'string') return e
  const o = e as Record<string, unknown>
  const msg = o.message ?? o.msg
  const code = o.code
  const details = o.details
  if (typeof msg === 'string' && msg) return code != null ? `${code}: ${msg}` : msg
  if (code != null) return String(code)
  if (typeof details === 'string' && details) return details
  try { return JSON.stringify(e) } catch { return String(e) }
}

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
      const msg = error?.message ?? ''
      const isLockError = msg.includes('LockManager') || msg.includes('lock') || msg.includes('timeout')
      const isNetworkError = msg.includes('Failed to fetch') || msg.includes('fetch') ||
        error?.name === 'TypeError' || msg.includes('NetworkError')
      
      if ((isLockError || isNetworkError) && i < maxRetries - 1) {
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
    const { data: { user }, error: authError } = await getCachedAuthUser()
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
      const errMsg = formatErr(insertError)
      console.error('Failed to create profile:', errMsg)
      throw new Error(`Failed to create profile: ${errMsg}`)
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

  // Other errors (network, permission, etc.)
  if (error) {
    const errMsg = formatErr(error)
    console.error('Profile fetch error:', errMsg)
    throw new Error(`Failed to load profile: ${errMsg}`)
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
  const { data: { user } } = await getCachedAuthUser()
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
  const { data: { user } } = await getCachedAuthUser()
  if (!user) return 0

  const today = toLocalDateStr(new Date())
  const { data: profile } = await supabase
    .from('profiles')
    .select('streak, last_active_date')
    .eq('id', user.id)
    .single()

  if (!profile) return 0

  if (profile.last_active_date === today) return profile.streak || 0

  const yesterday = toLocalDateStr(new Date(Date.now() - 86_400_000))
  const newStreak = profile.last_active_date === yesterday ? (profile.streak || 0) + 1 : 1

  await supabase
    .from('profiles')
    .update({ streak: newStreak, last_active_date: today })
    .eq('id', user.id)

  return newStreak
}

export async function getStreak(): Promise<number> {
  const { data: { user } } = await getCachedAuthUser()
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
  return withNetworkHandling(`workout-${Date.now()}`, async () => {
    const { data: { user } } = await getCachedAuthUser()
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
  })
}

export async function getWorkouts(): Promise<WorkoutRecord[]> {
  const { data: { user }, error: authError } = await getCachedAuthUser()
  if (authError || !user) return []

  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false })

  if (error) {
    console.error('Error fetching workouts:', formatErr(error))
    return []
  }

  return ((data || []) as Array<{ id: string; title: string; category: string; duration?: number; calories?: number; exercise_count?: number; completed_at?: string | null }>).map((w) => ({
    id: w.id,
    title: w.title,
    category: w.category,
    duration: w.duration || 0,
    calories: w.calories || 0,
    exerciseCount: w.exercise_count || 0,
    completedAt: w.completed_at ?? '',
  }))
}

// Run functions
export async function addRun(r: Omit<RunRecord, 'id' | 'completedAt'>) {
  return withNetworkHandling(`run-${Date.now()}`, async () => {
    const { data: { user } } = await getCachedAuthUser()
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
  })
}

export async function getRuns(): Promise<RunRecord[]> {
  const { data: { user }, error: authError } = await getCachedAuthUser()
  if (authError || !user) return []

  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false })

  if (error) {
    console.error('Error fetching runs:', formatErr(error))
    return []
  }

  return ((data || []) as Array<{ id: string; distance?: number | string; duration?: number; pace?: string; calories?: number; path?: [number, number][]; completed_at?: string | null }>).map((r) => ({
    id: r.id,
    distance: parseFloat(String(r.distance ?? 0)),
    duration: r.duration || 0,
    pace: r.pace || '0:00',
    calories: r.calories || 0,
    path: r.path || [],
    completedAt: r.completed_at ?? '',
  }))
}

// Coach session functions
export async function addCoachSession(r: Omit<CoachRecord, 'id' | 'completedAt'>) {
  return withNetworkHandling(`coach-${Date.now()}`, async () => {
    const { data: { user } } = await getCachedAuthUser()
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
  })
}

export async function getCoachSessions(): Promise<CoachRecord[]> {
  const { data: { user }, error: authError } = await getCachedAuthUser()
  if (authError || !user) return []

  const { data, error } = await supabase
    .from('coach_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false })

  if (error) {
    console.error('Error fetching coach sessions:', formatErr(error))
    return []
  }

  return ((data || []) as Array<{ id: string; exercise: string; reps?: number; score?: number; rep_scores?: number[]; completed_at?: string | null }>).map((c) => ({
    id: c.id,
    exercise: c.exercise,
    reps: c.reps || 0,
    score: c.score || 0,
    repScores: c.rep_scores || [],
    completedAt: c.completed_at ?? '',
  }))
}

// Favorites functions
export async function toggleFavorite(exerciseId: number) {
  const { data: { user } } = await getCachedAuthUser()
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
  return retryWithBackoff(async () => {
    const { data: { user }, error: authError } = await getCachedAuthUser()
    if (authError || !user) return []

    const { data, error } = await supabase
      .from('favorites')
      .select('exercise_id')
      .eq('user_id', user.id)

    if (error) {
      console.error('Error fetching favorites:', formatErr(error))
      return []
    }
    return ((data || []) as Array<{ exercise_id: number }>).map((f) => f.exercise_id)
  })
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
    console.error('Error getting total stats:', formatErr(error))
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
      const localDs = toLocalDateStr(date)
      const all = [...workouts, ...runs, ...coachSessions]
      const count = all.filter((r) => r.completedAt && toLocalDateStr(r.completedAt) === localDs).length
      return { day, count, active: count > 0 }
    })
  } catch (error) {
    console.error('Error getting weekly activity:', formatErr(error))
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
  const today = toLocalDateStr(new Date())

  const todayWorkouts = workouts.filter((w) => w.completedAt && toLocalDateStr(w.completedAt) === today)
  const todayRuns = runs.filter((r) => r.completedAt && toLocalDateStr(r.completedAt) === today)
  const todayCoach = coachSessions.filter((c) => c.completedAt && toLocalDateStr(c.completedAt) === today)

  return {
    workouts: todayWorkouts.length,
    runs: todayRuns.length,
    coachSessions: todayCoach.length,
    calories: [...todayWorkouts, ...todayRuns].reduce((a, x) => a + x.calories, 0),
    activeMinutes: todayWorkouts.reduce((a, w) => a + Math.round((w.duration || 0) / 60), 0) + todayRuns.reduce((a, r) => a + Math.round((r.duration || 0) / 60), 0) + todayCoach.length * 3,
  }
}

export async function getLastDoneExerciseIds(): Promise<number[]> {
  const workouts = await getWorkouts()
  const titles = new Set(workouts.map((w) => w.title))
  return [] // map title to exercise id if you have a mapping
}
