/**
 * Cross-device form duels via Supabase (`form_duels` + RPCs).
 */
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/database.types"
import type { Duel } from "@/lib/duels-types"
import { formatErr } from "@/lib/store-supabase"

type FormDuelRow = Database["public"]["Tables"]["form_duels"]["Row"]

function randomDuelCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let s = ""
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

function rowToDuel(row: FormDuelRow): Duel {
  return {
    id: row.id,
    code: row.code,
    exercise: row.exercise,
    createdAt: row.created_at,
    challengerScore: row.challenger_score,
    challengerName: row.challenger_name,
    opponentScore: row.opponent_score,
    opponentName: row.opponent_name,
    settled: row.settled,
    challengerUserId: row.challenger_user_id,
    opponentUserId: row.opponent_user_id,
  }
}

function mapJoinRpcError(err: {
  message?: string
  details?: string
  hint?: string
}): string | null {
  const blob = [err.message, err.details, err.hint].filter(Boolean).join(" ").toLowerCase()
  if (blob.includes("not_authenticated")) return "not_authenticated"
  if (blob.includes("invalid_code")) return "invalid_code"
  if (blob.includes("own_duel")) return "own_duel"
  if (blob.includes("duel_full")) return "duel_full"
  if (blob.includes("join_failed")) return "join_failed"
  return null
}

export async function createFormDuelRemote(
  exercise: string,
  challengerName: string
): Promise<Duel> {
  if (!isSupabaseConfigured()) throw new Error("supabase_not_configured")
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("not_authenticated")
  const name = (challengerName || "You").trim() || "You"
  const ex = (exercise || "Squats").trim() || "Squats"
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomDuelCode()
    const { data, error } = await supabase
      .from("form_duels")
      .insert({
        code,
        exercise: ex,
        challenger_user_id: user.id,
        challenger_name: name,
      })
      .select()
      .single()
    if (!error && data) return rowToDuel(data)
    if (error?.code === "23505") continue
    if (error) throw new Error(formatErr(error))
  }
  throw new Error("code_collision")
}

export async function joinFormDuelRemote(code: string, opponentName: string): Promise<Duel> {
  if (!isSupabaseConfigured()) throw new Error("supabase_not_configured")
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("not_authenticated")
  const { data, error } = await supabase.rpc("join_form_duel", {
    p_code: code.trim().toUpperCase(),
    p_opponent_name: opponentName,
  })
  if (error) {
    const mapped = mapJoinRpcError(error)
    if (mapped) throw new Error(mapped)
    throw new Error(formatErr(error))
  }
  return rowToDuel(data as FormDuelRow)
}

export async function listFormDuelsRemote(): Promise<Duel[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from("form_duels")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) throw new Error(formatErr(error))
  const rows = (data ?? []) as FormDuelRow[]
  return rows.map(rowToDuel)
}

export async function submitFormDuelScoreRemote(
  duelId: string,
  compositeScore: number
): Promise<Duel> {
  if (!isSupabaseConfigured()) throw new Error("supabase_not_configured")
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("not_authenticated")
  const { data, error } = await supabase.rpc("submit_form_duel_score", {
    p_duel_id: duelId,
    p_composite_score: compositeScore,
  })
  if (error) {
    const m = (error.message ?? "").toLowerCase()
    if (m.includes("not_found")) throw new Error("not_found")
    if (m.includes("forbidden")) throw new Error("forbidden")
    if (m.includes("invalid_score")) throw new Error("invalid_score")
    throw new Error(formatErr(error))
  }
  return rowToDuel(data as FormDuelRow)
}

/** When `1`, never call Supabase for Arena duels (codes stay on this device only). */
export function arenaDuelsForceLocalOnly(): boolean {
  return process.env.NEXT_PUBLIC_ARENA_DUELS_LOCAL_ONLY === "1"
}

function errorTextLooksLikeCloudBackendUnavailable(raw: string): boolean {
  const lower = raw.toLowerCase()
  return (
    lower.includes("form_duels") ||
    lower.includes("join_form_duel") ||
    lower.includes("submit_form_duel_score") ||
    lower.includes("schema cache") ||
    /\bpgrst\d+/i.test(raw) ||
    (lower.includes("relation") && lower.includes("does not exist")) ||
    lower.includes("could not find the table") ||
    lower.includes("undefined table") ||
    lower.includes("undefined function") ||
    (lower.includes("function") && lower.includes("does not exist")) ||
    /\b402\b/.test(raw) ||
    lower.includes("project is paused") ||
    lower.includes("project_not_active") ||
    lower.includes("payment required") ||
    lower.includes("forbidden") && lower.includes("billing")
  )
}

/** True when cloud duels cannot run (missing migration, paused/billing, etc.). */
export function isArenaCloudBackendUnavailableError(e: unknown): boolean {
  const raw = (e instanceof Error ? e.message : String(e)).trim()
  if (!raw) return false
  return errorTextLooksLikeCloudBackendUnavailable(raw)
}

const KNOWN_DUEL_ERROR_CODES = [
  "not_authenticated",
  "supabase_not_configured",
  "invalid_code",
  "own_duel",
  "duel_full",
  "join_failed",
  "code_collision",
  "not_found",
  "forbidden",
  "invalid_score",
] as const

export function formDuelUserMessage(code: string): string {
  switch (code) {
    case "not_authenticated":
      return "Sign in to use cloud duels with friends."
    case "supabase_not_configured":
      return "Cloud duels need Supabase to be configured."
    case "invalid_code":
      return "No open duel matches that code."
    case "own_duel":
      return "You can’t join your own duel — share the code with a friend."
    case "duel_full":
      return "That duel already has an opponent."
    case "join_failed":
      return "Could not join right now. Try again."
    case "code_collision":
      return "Could not generate a unique code. Try again."
    case "not_found":
      return "That duel no longer exists."
    case "forbidden":
      return "You’re not a participant in this duel."
    case "invalid_score":
      return "Invalid score."
    default:
      return "Something went wrong."
  }
}

/**
 * Maps thrown errors (including PostgREST `formatErr` strings) to user-facing toast text.
 */
export function resolveDuelToastMessage(e: unknown): string {
  const raw = (e instanceof Error ? e.message : String(e)).trim()
  if (!raw) return "Something went wrong."

  if ((KNOWN_DUEL_ERROR_CODES as readonly string[]).includes(raw)) {
    return formDuelUserMessage(raw)
  }

  const lower = raw.toLowerCase()
  if (errorTextLooksLikeCloudBackendUnavailable(raw)) {
    if (/\b402\b/.test(raw) || lower.includes("paused") || lower.includes("billing")) {
      return "Supabase returned a billing or project-availability error. Arena will use this device only until your project is active again — or set NEXT_PUBLIC_ARENA_DUELS_LOCAL_ONLY=1 in .env.local to skip cloud duels."
    }
    return "Cloud duels need the form_duels migration on Supabase (see supabase/migrations/20260901000000_form_duels.sql). Until then, use device-only duels or set NEXT_PUBLIC_ARENA_DUELS_LOCAL_ONLY=1 in .env.local."
  }

  if (
    lower.includes("row-level security") ||
    lower.includes("violates row-level security") ||
    lower.includes("42501") ||
    lower.includes("permission denied")
  ) {
    return "Couldn’t save this duel. Sign in again, or check that Row Level Security policies allow access to form_duels."
  }

  if (raw.length <= 200) return raw
  return `${raw.slice(0, 197)}…`
}
