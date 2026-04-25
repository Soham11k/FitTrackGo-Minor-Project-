const KEY = "fittrackgo_data"

export interface UserProfile {
  name: string
  level: "beginner" | "intermediate" | "advanced"
  goals: string[]
  joinDate: string
  onboarded: boolean
}

export interface WorkoutRecord {
  id: string
  title: string
  category: string
  duration: number
  calories: number
  exerciseCount: number
  completedAt: string
}

export interface RunRecord {
  id: string
  distance: number
  duration: number
  pace: string
  calories: number
  path: [number, number][]
  completedAt: string
}

export interface CoachRecord {
  id: string
  exercise: string
  reps: number
  score: number
  repScores: number[]
  completedAt: string
  /** Form-weighted rep volume (for fair rankings) */
  effectiveReps?: number
  /** Met verified-movement tier (high form bar) */
  verifiedMovement?: boolean
  /** Face-enrolled user with verified identity during counted reps */
  faceVerifiedSession?: boolean
}

export interface AppData {
  profile: UserProfile
  workouts: WorkoutRecord[]
  runs: RunRecord[]
  coachSessions: CoachRecord[]
  favorites: number[]
  streak: number
  lastActiveDate: string
}

const DEFAULTS: AppData = {
  profile: { name: "", level: "beginner", goals: [], joinDate: new Date().toISOString().split("T")[0], onboarded: false },
  workouts: [],
  runs: [],
  coachSessions: [],
  favorites: [],
  streak: 0,
  lastActiveDate: "",
}

function load(): AppData {
  if (typeof window === "undefined") return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

function persist(data: AppData) {
  if (typeof window === "undefined") return
  try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* quota */ }
}

export function getProfile(): UserProfile { return load().profile }
export function saveProfile(patch: Partial<UserProfile>) {
  const d = load()
  d.profile = { ...d.profile, ...patch }
  persist(d)
}

export function refreshStreak(): number {
  const d = load()
  const today = new Date().toISOString().split("T")[0]
  if (d.lastActiveDate === today) return d.streak
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0]
  d.streak = d.lastActiveDate === yesterday ? d.streak + 1 : 1
  d.lastActiveDate = today
  persist(d)
  return d.streak
}

export function getStreak(): number { return load().streak }

export function addWorkout(r: Omit<WorkoutRecord, "id" | "completedAt">) {
  const d = load()
  d.workouts.unshift({ ...r, id: crypto.randomUUID(), completedAt: new Date().toISOString() })
  persist(d)
  refreshStreak()
}

export function getWorkouts(): WorkoutRecord[] { return load().workouts }

export function addRun(r: Omit<RunRecord, "id" | "completedAt">) {
  const d = load()
  d.runs.unshift({ ...r, id: crypto.randomUUID(), completedAt: new Date().toISOString() })
  persist(d)
  refreshStreak()
}

export function getRuns(): RunRecord[] { return load().runs }

export function addCoachSession(r: Omit<CoachRecord, "id" | "completedAt">) {
  const d = load()
  d.coachSessions.unshift({ ...r, id: crypto.randomUUID(), completedAt: new Date().toISOString() })
  persist(d)
  refreshStreak()
}

export function getCoachSessions(): CoachRecord[] { return load().coachSessions }

export function toggleFavorite(exerciseId: number) {
  const d = load()
  const i = d.favorites.indexOf(exerciseId)
  if (i >= 0) d.favorites.splice(i, 1)
  else d.favorites.push(exerciseId)
  persist(d)
}

export function getFavorites(): number[] { return load().favorites }

export function getTotalStats() {
  const d = load()
  return {
    totalWorkouts: d.workouts.length + d.coachSessions.length,
    totalRuns: d.runs.length,
    totalCalories: [...d.workouts.map((w) => w.calories), ...d.runs.map((r) => r.calories)].reduce((a, b) => a + b, 0),
    totalDistance: d.runs.reduce((a, r) => a + r.distance, 0),
    totalActiveMinutes: d.workouts.reduce((a, w) => a + Math.round(w.duration / 60), 0) + d.runs.reduce((a, r) => a + Math.round(r.duration / 60), 0),
    streak: d.streak,
  }
}

export function getWeeklyActivity() {
  const d = load()
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  return labels.map((day, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    const ds = date.toISOString().split("T")[0]
    const count = [...d.workouts, ...d.runs, ...d.coachSessions].filter((r) => r.completedAt.startsWith(ds)).length
    return { day, count, active: count > 0 }
  })
}

export function getRecentActivity(limit = 10) {
  const d = load()
  const all: { type: string; title: string; detail: string; time: string }[] = [
    ...d.workouts.map((w) => ({ type: "workout", title: w.title, detail: `${w.exerciseCount} exercises · ${Math.round(w.duration / 60)}min`, time: w.completedAt })),
    ...d.runs.map((r) => ({ type: "run", title: "Run", detail: `${r.distance.toFixed(2)} km · ${r.pace} pace`, time: r.completedAt })),
    ...d.coachSessions.map((c) => ({ type: "coach", title: `AI: ${c.exercise}`, detail: `${c.reps} reps · ${c.score}%`, time: c.completedAt })),
  ]
  all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  return all.slice(0, limit)
}

export function getTodaySummary() {
  const d = load()
  const today = new Date().toISOString().split("T")[0]
  const workouts = d.workouts.filter((w) => w.completedAt.startsWith(today))
  const runs = d.runs.filter((r) => r.completedAt.startsWith(today))
  const coach = d.coachSessions.filter((c) => c.completedAt.startsWith(today))
  return {
    workouts: workouts.length,
    runs: runs.length,
    coachSessions: coach.length,
    calories: [...workouts, ...runs].reduce((a, x) => a + ("calories" in x ? x.calories : 0), 0),
    activeMinutes: [...workouts, ...runs, ...coach].reduce((a, x) => a + ("duration" in x ? Math.round(x.duration / 60) : 0), 0) + coach.length * 3,
  }
}

export function getLastDoneExerciseIds(): number[] {
  load()
  return [] // map title to exercise id if you have a mapping; for now return []
}
