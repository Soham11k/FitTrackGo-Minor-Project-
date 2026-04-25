/**
 * Client-side helpers for training programs.
 *
 * The Plan tab calls `getActiveProgramForUser()` to decide whether to show
 * the enroll CTA, a "Day N of M" view, or a "rest day" note.
 */
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/database.types"

export type Program = Tables<"programs">
export type ProgramDay = Tables<"program_days">
export type ProgramDayBlock = Tables<"program_day_blocks">
export type Enrollment = Tables<"user_program_enrollments">

export interface PlanState {
  enrollment: Enrollment | null
  program: Program | null
  today: ProgramDay | null
  blocks: ProgramDayBlock[]
  daysTotal: number
  completedDays: number
}

export async function listPrograms(): Promise<Program[]> {
  const supabase = createClient()
  const { data } = await supabase.from("programs").select("*").order("weeks")
  return (data ?? []) as Program[]
}

export async function getActiveProgramForUser(): Promise<PlanState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return empty()

  const { data: enroll } = await supabase
    .from("user_program_enrollments")
    .select("*, programs(*)")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle()

  if (!enroll) return empty()

  const enrollment = enroll as Enrollment & { programs: Program }
  const programId = enrollment.program_id
  const currentDay = enrollment.current_day ?? 1

  const { data: today } = await supabase
    .from("program_days")
    .select("*")
    .eq("program_id", programId)
    .eq("day_index", currentDay)
    .maybeSingle()

  let blocks: ProgramDayBlock[] = []
  if (today) {
    const { data: b } = await supabase
      .from("program_day_blocks")
      .select("*")
      .eq("program_day_id", today.id)
      .order("order_index")
    blocks = (b ?? []) as ProgramDayBlock[]
  }

  const { count: totalCount } = await supabase
    .from("program_days")
    .select("id", { count: "exact", head: true })
    .eq("program_id", programId)

  const { count: adhered } = await supabase
    .from("program_adherence")
    .select("id", { count: "exact", head: true })
    .eq("enrollment_id", enrollment.id)

  return {
    enrollment,
    program: enrollment.programs ?? null,
    today: (today as ProgramDay) ?? null,
    blocks,
    daysTotal: totalCount ?? 0,
    completedDays: adhered ?? 0,
  }
}

export async function enrollInProgram(programId: string): Promise<Enrollment | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  await supabase
    .from("user_program_enrollments")
    .update({ active: false })
    .eq("user_id", user.id)

  const { data, error } = await supabase
    .from("user_program_enrollments")
    .upsert(
      { user_id: user.id, program_id: programId, current_day: 1, active: true },
      { onConflict: "user_id,program_id" }
    )
    .select("*")
    .maybeSingle()
  if (error) {
    console.error("[programs] enroll failed:", error)
    return null
  }
  return (data as Enrollment) ?? null
}

export async function completeToday(params: {
  enrollmentId: string
  programDayId: string
  score?: number | null
  notes?: string | null
}): Promise<boolean> {
  const supabase = createClient()
  const { error: adhereErr } = await supabase.from("program_adherence").insert({
    enrollment_id: params.enrollmentId,
    program_day_id: params.programDayId,
    score: params.score ?? null,
    notes: params.notes ?? null,
  })
  if (adhereErr) return false

  // Advance current_day by one.
  const { data: enroll } = await supabase
    .from("user_program_enrollments")
    .select("current_day")
    .eq("id", params.enrollmentId)
    .maybeSingle()
  const nextDay = Math.max(1, (enroll?.current_day ?? 1) + 1)
  await supabase
    .from("user_program_enrollments")
    .update({ current_day: nextDay })
    .eq("id", params.enrollmentId)

  return true
}

/**
 * Progressive overload suggestion for a strength block.
 *
 * Rule: if last session's adherence score (RPE) was <= 7 AND the prior
 * session's reps were completed, bump the target reps by 1 (or weight +5%).
 * Caller decides what "weight" means for its unit system; we just return
 * the multiplier and rep delta.
 */
export function progressiveOverload(lastRpe: number | null, repsCompleted: boolean) {
  if (!repsCompleted) return { repsDelta: 0, weightMultiplier: 1 }
  if (lastRpe == null) return { repsDelta: 1, weightMultiplier: 1 }
  if (lastRpe <= 6) return { repsDelta: 1, weightMultiplier: 1.05 }
  if (lastRpe <= 7) return { repsDelta: 1, weightMultiplier: 1.025 }
  return { repsDelta: 0, weightMultiplier: 1 }
}

function empty(): PlanState {
  return { enrollment: null, program: null, today: null, blocks: [], daysTotal: 0, completedDays: 0 }
}
