import { createClient } from '@/lib/supabase/client'
import { isSupabaseFetchError } from '@/lib/supabase/config'
import {
  shouldSkipSupabaseNetwork,
} from '@/lib/supabase/connectivity-circuit'
import type { UserProfile, WorkoutRecord, RunRecord, CoachRecord } from './store'
import { parseRepTracesJson } from '@/lib/rep-trace'
import { isNetworkError } from './network-status'
import { enqueuePendingWrite } from '@/lib/offline-queue'
import {
  encryptUserDataStringPlain,
} from '@/lib/encryption/user-data-cipher'
import { isUserDataFieldEncryptionEnabled } from '@/lib/encryption/user-data-env'
import {
  getOrCreateUserDataContentKey,
} from '@/lib/encryption/content-key'
import { formatErr } from '@/lib/format-err'
import {
  decryptRunPath,
  maybeDecryptProfileName,
  maybeEncryptProfileNameForWrite,
  runPathCipherColumnUnsupported,
  scheduleEncryptPlainProfileNameIfNeeded,
} from '@/lib/store-supabase/user-data-field-crypto'

export { formatErr }

function getSupabase() {
  return createClient()
}

type AuthUserResult = Awaited<ReturnType<ReturnType<typeof getSupabase>['auth']['getUser']>>

// Small helper to avoid hammering auth.getUser in parallel and triggering browser locks
let cachedAuthUserPromise: Promise<AuthUserResult> | null = null
let cachedAuthUserAt = 0
const AUTH_USER_CACHE_MS = 15_000

function isDevSupabaseOffline(): boolean {
  return process.env.NODE_ENV === 'development' && shouldSkipSupabaseNetwork()
}

function offlineDevProfile(): UserProfile {
  return {
    name: '',
    level: 'beginner',
    goals: [],
    joinDate: new Date().toISOString().slice(0, 10),
    onboarded: true,
  }
}

async function getCachedAuthUser() {
  if (shouldSkipSupabaseNetwork()) {
    return { data: { user: null }, error: null } as AuthUserResult
  }

  const now = Date.now()
  if (!cachedAuthUserPromise || now - cachedAuthUserAt > AUTH_USER_CACHE_MS) {
    cachedAuthUserAt = now
    cachedAuthUserPromise = retryWithBackoff(
      () => getSupabase().auth.getUser(),
      3,
      150
    )
  }
  return cachedAuthUserPromise
}

/** After sign-in / sign-up, clear the cache so getUser() sees the new session (avoids a stale 15s window with no user). */
export function invalidateAuthUserCache() {
  cachedAuthUserPromise = null
  cachedAuthUserAt = 0
}

function toLocalDateStr(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function newOfflineMutationId(kind: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${kind}:${crypto.randomUUID()}`
  }
  return `${kind}:${Date.now()}:${Math.random().toString(16).slice(2)}`
}

/** True when coach_sessions row references columns not present in the remote DB (run `20250301000000_coach_session_competition.sql`). */
function coachSessionOptionalColumnsUnsupported(e: unknown): boolean {
  const code = (e as { code?: string })?.code
  const msg = String((e as { message?: string })?.message ?? '')
  if (/schema cache/i.test(msg) && /effective_reps|verified_movement|face_verified_session/i.test(msg)) return true
  if (code === 'PGRST204' && /effective_reps|verified_movement|face_verified_session/i.test(msg)) return true
  return false
}

function coachRepTracesColumnUnsupported(e: unknown): boolean {
  const code = (e as { code?: string })?.code
  const msg = String((e as { message?: string })?.message ?? "")
  if (code === "PGRST204" && /\brep_traces\b/i.test(msg)) return true
  if (/schema cache/i.test(msg) && /\brep_traces\b/i.test(msg)) return true
  return false
}

function coachSessionLoadUnsupported(e: unknown): boolean {
  const code = (e as { code?: string })?.code
  const msg = String((e as { message?: string })?.message ?? "")
  if (code === "PGRST204" && /\bload_kg|volume_kg\b/i.test(msg)) return true
  if (/schema cache/i.test(msg) && /\bload_kg|volume_kg\b/i.test(msg)) return true
  return false
}

function coachSessionKindUnsupported(e: unknown): boolean {
  const code = (e as { code?: string })?.code
  const msg = String((e as { message?: string })?.message ?? "")
  if (code === "PGRST204" && /\bkind\b/i.test(msg)) return true
  if (/schema cache/i.test(msg) && /\bkind\b/i.test(msg)) return true
  return false
}

function coachSessionExerciseSpecIdUnsupported(e: unknown): boolean {
  const code = (e as { code?: string })?.code
  const msg = String((e as { message?: string })?.message ?? "")
  if (code === "PGRST204" && /\bexercise_spec_id\b/i.test(msg)) return true
  if (/schema cache/i.test(msg) && /\bexercise_spec_id\b/i.test(msg)) return true
  return false
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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      const errorName = error instanceof Error ? error.name : ""
      const isLockError = msg.includes('LockManager') || msg.includes('lock') || msg.includes('timeout')
      const isNetworkError =
        isSupabaseFetchError(error) ||
        msg.includes('Failed to fetch') ||
        msg.includes('fetch') ||
        errorName === 'TypeError' ||
        msg.includes('NetworkError') ||
        errorName === 'AuthRetryableFetchError'

      if (isNetworkError && process.env.NODE_ENV === 'development') {
        throw error
      }

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

function isLikelyRpcNotDeployed(error: unknown): boolean {
  const o = error as { code?: string; message?: string }
  const code = String(o?.code ?? '')
  const msg = String(o?.message ?? '').toLowerCase()
  return (
    code === 'PGRST202' ||
    (/\bcould not find the function\b/.test(msg) && /\bschema cache\b/.test(msg))
  )
}

// Profile functions
export async function getProfile(): Promise<UserProfile> {
  return retryWithBackoff(async () => {
    const { data: { user }, error: authError } = await getCachedAuthUser()
    if (isDevSupabaseOffline()) {
      return offlineDevProfile()
    }
    if (authError) {
      const m = authError.message ?? ''
      if (
        m.includes('unreachable') ||
        m.includes('not configured') ||
        m.includes('check:supabase-host')
      ) {
        return offlineDevProfile()
      }
      throw new Error(`Authentication error: ${authError.message}`)
    }
    if (!user) throw new Error('Not authenticated')

  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // No row returned (.single() → PGRST116). Common cases: truly missing row, or a race with
  // `handle_new_user` (migration trigger) that already inserted — plain INSERT then 23505.
  if (error && error.code === 'PGRST116') {
    const defaultName =
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.display_name ||
      user.email?.split('@')[0] ||
      'Athlete'

    const joinDateStr = new Date().toISOString().split('T')[0]
    const sb = getSupabase()
    const { error: rpcError } = await sb.rpc('ensure_own_profile_bootstrap', {
      p_name: defaultName,
      p_level: 'beginner',
      p_goals: [] as string[],
      p_join_date: joinDateStr,
      p_onboarded: false,
    })

    let ensureFailed = rpcError ?? null

    // RPC shipped in migration `20261201000000_profiles_ensure_rpc.sql` — if DB never got it,
    // PostgREST returns PGRST202. Fall back to direct upsert (works when RLS allows JWT).
    if (ensureFailed && isLikelyRpcNotDeployed(rpcError)) {
      console.warn(
        '[profiles] ensure_own_profile_bootstrap RPC missing — using client upsert. Run migrations (e.g. npm run db:push or paste migration SQL in Supabase).',
      )
      const { error: upsertError } = await sb
        .from('profiles')
        .upsert(
          {
            id: user.id,
            name: defaultName,
            level: 'beginner',
            goals: [],
            join_date: joinDateStr,
            onboarded: false,
          },
          { onConflict: 'id', ignoreDuplicates: true },
        )
      ensureFailed = upsertError ?? null
    }

    if (ensureFailed) {
      const errMsg = formatErr(ensureFailed)
      console.error('Failed to ensure profile:', errMsg)
      throw new Error(`Failed to create profile: ${errMsg}`)
    }

    const { data: row, error: again } = await sb
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (again || !row) {
      const errMsg = again ? formatErr(again) : 'empty profile after upsert'
      console.error('Failed to load profile after ensure:', errMsg)
      throw new Error(`Failed to load profile: ${errMsg}`)
    }

    scheduleEncryptPlainProfileNameIfNeeded(user.id, row.name ?? null)
    return {
      name: await maybeDecryptProfileName(row.name),
      level: (row.level as UserProfile['level']) || 'beginner',
      goals: row.goals || [],
      joinDate: row.join_date || new Date().toISOString().split('T')[0],
      onboarded: row.onboarded || false,
      bodyWeightKg: row.body_weight_kg ?? undefined,
      weightUnit: (row.weight_unit as UserProfile['weightUnit']) ?? 'kg',
    }
  }

  // Other errors (network, permission, etc.)
  if (error) {
    const errMsg = formatErr(error)
    console.error('Profile fetch error:', errMsg)
    throw new Error(`Failed to load profile: ${errMsg}`)
  }

  if (!data) throw new Error('Profile missing')

  scheduleEncryptPlainProfileNameIfNeeded(user.id, data.name ?? null)
  return {
    name: await maybeDecryptProfileName(data.name),
    level: (data.level as UserProfile['level']) || 'beginner',
    goals: data.goals || [],
    joinDate: data.join_date || new Date().toISOString().split('T')[0],
    onboarded: data.onboarded || false,
    bodyWeightKg: data.body_weight_kg ?? undefined,
    weightUnit: (data.weight_unit as UserProfile['weightUnit']) ?? 'kg',
  }
  })
}

export async function saveProfile(patch: Partial<UserProfile>) {
  const { data: { user } } = await getCachedAuthUser()
  if (!user) throw new Error('Not authenticated')

  const updates: Partial<{
    name: string
    level: UserProfile['level']
    goals: string[]
    onboarded: boolean
    body_weight_kg: number | null
    weight_unit: 'kg' | 'lb'
  }> = {}
  if (patch.name !== undefined) updates.name = await maybeEncryptProfileNameForWrite(patch.name)
  if (patch.level !== undefined) updates.level = patch.level
  if (patch.goals !== undefined) updates.goals = patch.goals
  if (patch.onboarded !== undefined) updates.onboarded = patch.onboarded
  if (patch.bodyWeightKg !== undefined) updates.body_weight_kg = patch.bodyWeightKg ?? null
  if (patch.weightUnit !== undefined) updates.weight_unit = patch.weightUnit

  const { error } = await getSupabase()
    .from('profiles')
    .upsert({ id: user.id, ...updates }, { onConflict: 'id' })

  if (error) throw error
}

export async function refreshStreak(): Promise<number> {
  const { data: { user } } = await getCachedAuthUser()
  if (!user) return 0

  const today = toLocalDateStr(new Date())
  const { data: profile } = await getSupabase()
    .from('profiles')
    .select('streak, last_active_date')
    .eq('id', user.id)
    .single()

  if (!profile) return 0

  if (profile.last_active_date === today) return profile.streak || 0

  const yesterday = toLocalDateStr(new Date(Date.now() - 86_400_000))
  const newStreak = profile.last_active_date === yesterday ? (profile.streak || 0) + 1 : 1

  await getSupabase()
    .from('profiles')
    .update({ streak: newStreak, last_active_date: today })
    .eq('id', user.id)

  return newStreak
}

export async function getStreak(): Promise<number> {
  const { data: { user } } = await getCachedAuthUser()
  if (!user) return 0

  const { data } = await getSupabase()
    .from('profiles')
    .select('streak')
    .eq('id', user.id)
    .single()

  return data?.streak || 0
}

async function enqueueRunPayload(r: Omit<RunRecord, 'id' | 'completedAt'>) {
  try {
    await enqueuePendingWrite({
      id: newOfflineMutationId('run'),
      kind: 'run',
      payload: r,
      createdAt: Date.now(),
    })
  } catch (err) {
    console.warn('[offline] could not persist pending run', err)
  }
}

async function enqueueWorkoutPayload(r: Omit<WorkoutRecord, 'id' | 'completedAt'>) {
  try {
    await enqueuePendingWrite({
      id: newOfflineMutationId('workout'),
      kind: 'workout',
      payload: r,
      createdAt: Date.now(),
    })
  } catch (err) {
    console.warn('[offline] could not persist pending workout', err)
  }
}

async function enqueueCoachPayload(r: Omit<CoachRecord, 'id' | 'completedAt'>) {
  try {
    await enqueuePendingWrite({
      id: newOfflineMutationId('coach'),
      kind: 'coach',
      payload: r,
      createdAt: Date.now(),
    })
  } catch (err) {
    console.warn('[offline] could not persist pending coach session', err)
  }
}

/** Direct insert (replay from IndexedDB offline queue). */
export async function commitWorkoutInsert(r: Omit<WorkoutRecord, 'id' | 'completedAt'>) {
  const { data: { user } } = await getCachedAuthUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await getSupabase()
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

// Workout functions
export async function addWorkout(r: Omit<WorkoutRecord, 'id' | 'completedAt'>) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueWorkoutPayload(r)
    throw new TypeError('Failed to fetch: offline')
  }
  try {
    await commitWorkoutInsert(r)
  } catch (error) {
    if (isNetworkError(error)) await enqueueWorkoutPayload(r)
    throw error
  }
}

export async function getWorkouts(): Promise<WorkoutRecord[]> {
  const { data: { user }, error: authError } = await getCachedAuthUser()
  if (authError || !user) return []

  const { data, error } = await getSupabase()
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

/** Direct insert (replay from IndexedDB offline queue). */
export async function commitRunInsert(r: Omit<RunRecord, 'id' | 'completedAt'>) {
  const { data: { user } } = await getCachedAuthUser()
  if (!user) throw new Error('Not authenticated')

  let pathPayload: [number, number][] | null = r.path?.length ? r.path : null
  let path_cipher: string | null = null
  if (isUserDataFieldEncryptionEnabled() && pathPayload && pathPayload.length > 0) {
    const k = await getOrCreateUserDataContentKey()
    if (k) {
      try {
        path_cipher = await encryptUserDataStringPlain(JSON.stringify(pathPayload), k)
        pathPayload = null
      } catch {
        path_cipher = null
      }
    }
  }

  const row: Record<string, unknown> = {
    user_id: user.id,
    distance: r.distance,
    duration: r.duration,
    pace: r.pace,
    calories: r.calories,
    path: pathPayload,
  }
  if (path_cipher) row.path_cipher = path_cipher

  let { error } = await getSupabase().from('runs').insert(row)
  if (error && path_cipher && runPathCipherColumnUnsupported(error)) {
    console.warn('[runs] path_cipher unsupported — storing plaintext path. Apply migration 20260525100000_run_path_cipher.sql')
    delete row.path_cipher
    row.path = r.path?.length ? r.path : null
    const retry = await getSupabase().from('runs').insert(row)
    error = retry.error
  }
  if (error) throw error
  await refreshStreak()
}

// Run functions
export async function addRun(r: Omit<RunRecord, 'id' | 'completedAt'>) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueRunPayload(r)
    throw new TypeError('Failed to fetch: offline')
  }
  try {
    await commitRunInsert(r)
  } catch (error) {
    if (isNetworkError(error)) await enqueueRunPayload(r)
    throw error
  }
}

export async function getRuns(): Promise<RunRecord[]> {
  const { data: { user }, error: authError } = await getCachedAuthUser()
  if (authError || !user) return []

  const { data, error } = await getSupabase()
    .from('runs')
    .select('*')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false })

  if (error) {
    console.error('Error fetching runs:', formatErr(error))
    return []
  }

  const rows =
    ((data ||
      []) as Array<{
        id: string
        distance?: number | string
        duration?: number
        pace?: string
        calories?: number
        path?: [number, number][] | null
        path_cipher?: string | null
        completed_at?: string | null
      }>) ?? []

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      distance: parseFloat(String(r.distance ?? 0)),
      duration: r.duration || 0,
      pace: r.pace || '0:00',
      calories: r.calories || 0,
      path: await decryptRunPath({
        path: r.path ?? null,
        path_cipher: r.path_cipher ?? null,
      }),
      completedAt: r.completed_at ?? '',
    })),
  )
}

/** Direct insert (replay from IndexedDB offline queue). Returns inserted row id when supported. */
export async function commitCoachInsert(r: Omit<CoachRecord, 'id' | 'completedAt'>): Promise<string | null> {
  const { data: { user } } = await getCachedAuthUser()
  if (!user) throw new Error('Not authenticated')

  const row: Record<string, unknown> = {
    user_id: user.id,
    exercise: r.exercise,
    reps: r.reps,
    score: r.score,
    rep_scores: r.repScores,
  }
  if (r.effectiveReps !== undefined) row.effective_reps = r.effectiveReps
  if (r.verifiedMovement !== undefined) row.verified_movement = r.verifiedMovement
  if (r.faceVerifiedSession !== undefined) row.face_verified_session = r.faceVerifiedSession
  if (Array.isArray(r.repTraces) && r.repTraces.length > 0) {
    row.rep_traces = r.repTraces
  }
  if (r.kind && r.kind !== "rep") row.kind = r.kind
  if (r.loadKg !== undefined) row.load_kg = r.loadKg
  if (r.volumeKg !== undefined) row.volume_kg = r.volumeKg
  if (r.exerciseSpecId) row.exercise_spec_id = r.exerciseSpecId

  const insert = (p: Record<string, unknown>) =>
    getSupabase().from('coach_sessions').insert(p).select('id').maybeSingle()

  let payload = { ...row }
  let data: { id?: string | null } | null = null
  let error: { code?: string; message?: string } | null = null
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await insert(payload)
    data = res.data
    error = res.error
    if (!error) break
    if (coachRepTracesColumnUnsupported(error) && payload.rep_traces != null) {
      const p = { ...payload }
      delete p.rep_traces
      payload = p
      continue
    }
    if (coachSessionKindUnsupported(error) && payload.kind != null) {
      const p = { ...payload }
      delete p.kind
      payload = p
      continue
    }
    if (coachSessionLoadUnsupported(error)) {
      const p = { ...payload }
      delete p.load_kg
      delete p.volume_kg
      payload = p
      continue
    }
    if (coachSessionExerciseSpecIdUnsupported(error) && payload.exercise_spec_id != null) {
      const p = { ...payload }
      delete p.exercise_spec_id
      payload = p
      continue
    }
    if (coachSessionOptionalColumnsUnsupported(error)) {
      const minimal = { ...payload } as Record<string, unknown>
      delete minimal.effective_reps
      delete minimal.verified_movement
      delete minimal.face_verified_session
      payload = minimal
      continue
    }
    throw error
  }

  if (error) throw error
  await refreshStreak()
  const id = data && typeof data === 'object' && 'id' in data ? (data as { id: unknown }).id : null
  return typeof id === 'string' ? id : null
}

// Coach session functions
export async function addCoachSession(r: Omit<CoachRecord, 'id' | 'completedAt'>): Promise<string | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueCoachPayload(r)
    throw new TypeError('Failed to fetch: offline')
  }
  try {
    return await commitCoachInsert(r)
  } catch (error) {
    if (isNetworkError(error)) await enqueueCoachPayload(r)
    throw error
  }
}

export async function getCoachSessions(): Promise<CoachRecord[]> {
  const { data: { user }, error: authError } = await getCachedAuthUser()
  if (authError || !user) return []

  const { data, error } = await getSupabase()
    .from('coach_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false })

  if (error) {
    console.error('Error fetching coach sessions:', formatErr(error))
    return []
  }

  return ((data || []) as Array<{
    id: string
    exercise: string
    reps?: number
    score?: number
    rep_scores?: number[]
    rep_traces?: unknown
    kind?: string
    effective_reps?: number | null
    verified_movement?: boolean | null
    face_verified_session?: boolean | null
    completed_at?: string | null
    load_kg?: number | null
    volume_kg?: number | null
    exercise_spec_id?: string | null
  }>).map((c) => {
    const traces = parseRepTracesJson(c.rep_traces)
    return {
      id: c.id,
      exercise: c.exercise,
      reps: c.reps || 0,
      score: c.score || 0,
      repScores: c.rep_scores || [],
      repTraces: traces.length ? traces : undefined,
      kind: c.kind === "rom" ? "rom" : "rep",
      completedAt: c.completed_at ?? '',
      effectiveReps: c.effective_reps ?? undefined,
      verifiedMovement: c.verified_movement ?? undefined,
      faceVerifiedSession: c.face_verified_session ?? undefined,
      loadKg: c.load_kg ?? undefined,
      volumeKg: c.volume_kg ?? undefined,
      exerciseSpecId: c.exercise_spec_id ?? undefined,
    }
  })
}

// Favorites functions
export async function toggleFavorite(exerciseId: number) {
  const { data: { user } } = await getCachedAuthUser()
  if (!user) throw new Error('Not authenticated')

  const { data: existing } = await getSupabase()
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('exercise_id', exerciseId)
    .single()

  if (existing) {
    const { error } = await getSupabase()
      .from('favorites')
      .delete()
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await getSupabase()
      .from('favorites')
      .insert({ user_id: user.id, exercise_id: exerciseId })
    if (error) throw error
  }
}

export async function getFavorites(): Promise<number[]> {
  return retryWithBackoff(async () => {
    const { data: { user }, error: authError } = await getCachedAuthUser()
    if (authError || !user) return []

    const { data, error } = await getSupabase()
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
    ...runs.map((r) => {
      const km = Number.isFinite(r.distance) ? r.distance : 0
      return { type: 'run', title: 'Run', detail: `${km.toFixed(2)} km · ${r.pace ?? '—'} pace`, time: r.completedAt }
    }),
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
  await getWorkouts()
  return [] // map title to exercise id if you have a mapping
}
