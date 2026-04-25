/**
 * Async form duels — stored locally until you add a shared backend.
 */

const KEY = "fittrackgo_duels_v1"

export interface Duel {
  id: string
  code: string
  exercise: string
  createdAt: string
  challengerScore: number | null
  challengerName: string
  opponentScore: number | null
  opponentName: string | null
  settled: boolean
}

interface Store { duels: Duel[] }

function load(): Store {
  if (typeof window === "undefined") return { duels: [] }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { duels: [] }
    const p = JSON.parse(raw) as Store
    return Array.isArray(p?.duels) ? p : { duels: [] }
  } catch {
    return { duels: [] }
  }
}

function save(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch { /* quota */ }
}

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let s = ""
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export function createDuel(exercise: string, challengerName: string): Duel {
  const s = load()
  const duel: Duel = {
    id: crypto.randomUUID(),
    code: randomCode(),
    exercise,
    createdAt: new Date().toISOString(),
    challengerScore: null,
    challengerName: challengerName || "You",
    opponentScore: null,
    opponentName: null,
    settled: false,
  }
  s.duels.unshift(duel)
  s.duels = s.duels.slice(0, 20)
  save(s)
  return duel
}

export function joinDuelByCode(code: string, opponentName: string): Duel | null {
  const s = load()
  const c = code.trim().toUpperCase()
  const d = s.duels.find((x) => x.code === c && !x.settled)
  if (!d) return null
  d.opponentName = opponentName || "Opponent"
  save(s)
  return d
}

export function submitDuelScore(duelId: string, role: "challenger" | "opponent", compositeScore: number) {
  const s = load()
  const d = s.duels.find((x) => x.id === duelId)
  if (!d) return
  if (role === "challenger") d.challengerScore = compositeScore
  else d.opponentScore = compositeScore
  if (d.challengerScore != null && d.opponentScore != null) d.settled = true
  save(s)
}

export function listDuels(): Duel[] {
  return load().duels
}
