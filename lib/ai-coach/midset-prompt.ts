import type { ExerciseId } from "@/lib/form-analysis"
import type { RepTracePair } from "@/lib/rep-trace"

function summarizeRepTrace(pair: RepTracePair | undefined): string {
  if (!pair) return ""
  const faults = [...new Set([...pair.top.faults, ...pair.bottom.faults].map((x) => x.trim()).filter(Boolean))]
  const faultsTxt = faults.slice(0, 3).join("; ") || "no major faults flagged"
  return `rep ${pair.rep}: ${faultsTxt}`
}

export function buildMidsetTipMessages(opts: {
  exerciseId: ExerciseId
  exerciseName: string
  repScores: number[]
  repTraces: RepTracePair[]
}): { system: string; user: string } {
  const lastScores = opts.repScores.slice(-8)
  const trend =
    lastScores.length >= 2
      ? lastScores[lastScores.length - 1]! - lastScores[lastScores.length - 2]!
      : 0
  const avg = lastScores.length
    ? Math.round(lastScores.reduce((a, b) => a + b, 0) / lastScores.length)
    : 0

  const tracesLines = opts.repTraces
    .slice(-5)
    .map((p) => summarizeRepTrace(p))
    .filter(Boolean)

  const system = [
    "You are a concise strength-coach assistant.",
    "Return exactly one actionable sentence.",
    "No markdown, bullets, numbering, apologies, disclaimers about being an AI.",
    "Max 120 characters.",
  ].join(" ")

  const user = [
    `Exercise: ${opts.exerciseName} (${opts.exerciseId})`,
    `Recent rep scores tail: ${lastScores.join(", ") || "n/a"}`,
    `Rolling avg last window: ~${avg}`,
    `Last rep vs prior delta: ${trend >= 0 ? "+" : ""}${trend}`,
    "Recent faults / cues from on-device checkpoints:",
    tracesLines.join("\n") || "(no textual traces yet)",
  ].join("\n")

  return { system, user }
}
