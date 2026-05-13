/** Pure helper: pick a motivational next-action cue from recent activity signals. */

import type { RunRecord } from "@/lib/store"

export type TodayPromptKind = "run" | "mobility" | "streak" | "coach"

export type TodayPrompt = {
  kind: TodayPromptKind
  /** Short headline for chips */
  title: string
  hint: string
}

function localDateStr(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** @param streakDays — streak from dashboard / store */
/** @param mobilityMinutesThisWeek — optional minutes from ROM coach sessions summary */
export function resolveTodayPrompt(input: {
  runs: Pick<RunRecord, "completedAt" | "distance">[]
  streakDays: number
  coachSessionsThisWeekRomMinutes?: number
}): TodayPrompt | null {
  const todayStr = localDateStr(new Date())
  const ranToday = input.runs.some((r) => r.completedAt && localDateStr(r.completedAt) === todayStr)

  const weekKm = (() => {
    const weekAgo = Date.now() - 7 * 86400000
    return input.runs
      .filter((r) => r.completedAt && new Date(r.completedAt).getTime() >= weekAgo)
      .reduce((a, r) => a + (Number(r.distance) || 0), 0)
  })()

  if (input.streakDays >= 3 && !ranToday) {
    return {
      kind: "streak",
      title: "Streak day",
      hint: `Keep your ${input.streakDays}-day streak — log a short run or coach set.`,
    }
  }

  const rom = input.coachSessionsThisWeekRomMinutes ?? 0
  if (rom < 8) {
    return {
      kind: "mobility",
      title: "Recovery",
      hint: "8+ min mobility this week keeps joints happy before your next hard session.",
    }
  }

  if (weekKm < 5) {
    return {
      kind: "run",
      title: "Build volume",
      hint: `${weekKm.toFixed(1)} km this week · aim for 5+ km to level up.`,
    }
  }

  return {
    kind: "coach",
    title: "Form checkpoint",
    hint: "10 perfect reps beats 20 sloppy ones — hit Coach for one focused set.",
  }
}
