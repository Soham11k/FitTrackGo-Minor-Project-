import type { FormBreakdown } from "@/lib/form-analysis"

/** Pick concise coaching bullets for post-set recap (problems first, then positives). */
export function topCuesFromBreakdown(
  breakdown: FormBreakdown[],
  feedback: string[],
  max = 3
): string[] {
  const out: string[] = []
  const issues = breakdown.filter((b) => !b.ok)
  for (const b of issues) {
    const line = b.detail ? `${b.label}: ${b.detail}` : `${b.label}: ${b.value}`
    if (!out.includes(line)) out.push(line)
    if (out.length >= max) return out.slice(0, max)
  }
  const positives = breakdown.filter((b) => b.ok)
  for (const b of positives) {
    const line = `${b.label}: ${b.value}`
    if (!out.includes(line)) out.push(line)
    if (out.length >= max) return out.slice(0, max)
  }
  for (const f of feedback) {
    const t = f.trim()
    if (t && !out.includes(t)) out.push(t)
    if (out.length >= max) break
  }
  return out.slice(0, max)
}
