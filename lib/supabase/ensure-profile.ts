import type { SupabaseClient, User } from "@supabase/supabase-js"
import { formatErr } from "@/lib/format-err"
import type { UserProfile } from "@/lib/store"
import {
  maybeDecryptProfileName,
  scheduleEncryptPlainProfileNameIfNeeded,
} from "@/lib/store-supabase/user-data-field-crypto"

export type ProfileRow = {
  name: string | null
  level: string | null
  goals: string[] | null
  join_date: string | null
  onboarded: boolean | null
  body_weight_kg?: number | null
  weight_unit?: string | null
}

export function isRlsViolation(error: unknown): boolean {
  const o = error as { code?: string; message?: string }
  const code = String(o?.code ?? "")
  const msg = String(o?.message ?? "").toLowerCase()
  return code === "42501" || msg.includes("row-level security")
}

export function isLikelyRpcNotDeployed(error: unknown): boolean {
  const o = error as { code?: string; message?: string }
  const code = String(o?.code ?? "")
  const msg = String(o?.message ?? "").toLowerCase()
  return (
    code === "PGRST202" ||
    (/\bcould not find the function\b/.test(msg) && /\bschema cache\b/.test(msg))
  )
}

/** Wait until the browser client has a JWT for PostgREST (getUser alone is not enough). */
export async function ensureClientSessionForDb(
  sb: { auth: SupabaseClient["auth"] },
  maxAttempts = 4,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data: { session } } = await sb.auth.getSession()
    if (session?.access_token) return
    if (i < maxAttempts - 1) {
      await sb.auth.refreshSession().catch(() => undefined)
      await new Promise((r) => setTimeout(r, 80 * (i + 1)))
    }
  }
  throw new Error("Session not ready for database requests. Sign in again.")
}

export async function fetchOwnProfileRow(
  sb: Pick<SupabaseClient, "from">,
  userId: string,
): Promise<{ row: ProfileRow | null; error: unknown | null }> {
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle()
  if (error) return { row: null, error }
  return { row: data as ProfileRow | null, error: null }
}

export function profileRowToUserProfile(row: ProfileRow): UserProfile {
  return {
    name: row.name ?? "",
    level: (row.level as UserProfile["level"]) || "beginner",
    goals: row.goals || [],
    joinDate: row.join_date || new Date().toISOString().split("T")[0],
    onboarded: row.onboarded || false,
    bodyWeightKg: row.body_weight_kg ?? undefined,
    weightUnit: (row.weight_unit as UserProfile["weightUnit"]) ?? "kg",
  }
}

export async function mapProfileRow(userId: string, row: ProfileRow): Promise<UserProfile> {
  scheduleEncryptPlainProfileNameIfNeeded(userId, row.name ?? null)
  const mapped = profileRowToUserProfile(row)
  mapped.name = (await maybeDecryptProfileName(row.name)) ?? ""
  return mapped
}

function defaultProfileFields(user: User) {
  const defaultName =
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    "Athlete"
  return {
    defaultName: String(defaultName),
    joinDateStr: new Date().toISOString().split("T")[0],
  }
}

async function callEnsureRpc(
  sb: Pick<SupabaseClient, "rpc">,
  user: User,
): Promise<unknown | null> {
  const { defaultName, joinDateStr } = defaultProfileFields(user)
  const { error } = await sb.rpc("ensure_own_profile_bootstrap", {
    p_name: defaultName,
    p_level: "beginner",
    p_goals: [] as string[],
    p_join_date: joinDateStr,
    p_onboarded: false,
  })
  return error ?? null
}

async function callClientUpsert(
  sb: Pick<SupabaseClient, "from">,
  user: User,
): Promise<unknown | null> {
  const { defaultName, joinDateStr } = defaultProfileFields(user)
  const { error } = await sb.from("profiles").upsert(
    {
      id: user.id,
      name: defaultName,
      level: "beginner",
      goals: [],
      join_date: joinDateStr,
      onboarded: false,
    },
    { onConflict: "id", ignoreDuplicates: true },
  )
  return error ?? null
}

async function bootstrapViaServerApi(): Promise<boolean> {
  try {
    const res = await fetch("/api/profile/bootstrap", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Create the user's profile row when missing. Tolerates auth-trigger races and
 * falls back to a service-role API when client RLS blocks inserts (RPC not migrated).
 */
export async function ensureOwnProfileRow(
  sb: SupabaseClient,
  user: User,
): Promise<{ ok: true; row: ProfileRow } | { ok: false; error: string }> {
  await ensureClientSessionForDb(sb)

  // Auth trigger may have inserted between earlier reads and now.
  await new Promise((r) => setTimeout(r, 120))
  const raced = await fetchOwnProfileRow(sb, user.id)
  if (raced.row) return { ok: true, row: raced.row }

  let ensureFailed: unknown | null = await callEnsureRpc(sb, user)

  if (ensureFailed && isLikelyRpcNotDeployed(ensureFailed)) {
    console.warn(
      "[profiles] ensure_own_profile_bootstrap RPC missing — using client upsert. Run: npm run db:push",
    )
    ensureFailed = await callClientUpsert(sb, user)
  }

  if (ensureFailed) {
    const { row: afterFail } = await fetchOwnProfileRow(sb, user.id)
    if (afterFail) return { ok: true, row: afterFail }

    if (isRlsViolation(ensureFailed)) {
      const viaApi = await bootstrapViaServerApi()
      if (viaApi) {
        const { row: fromApi } = await fetchOwnProfileRow(sb, user.id)
        if (fromApi) return { ok: true, row: fromApi }
      }
    }

    return { ok: false, error: formatErr(ensureFailed) }
  }

  const { row, error: loadErr } = await fetchOwnProfileRow(sb, user.id)
  if (loadErr || !row) {
    return { ok: false, error: loadErr ? formatErr(loadErr) : "empty profile after bootstrap" }
  }
  return { ok: true, row }
}
