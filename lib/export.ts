import type { RunRecord, WorkoutRecord, CoachRecord, UserProfile } from "@/lib/store"

function xmlEscape(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** Build a GPX 1.1 document for a single run. */
export function runToGpx(run: RunRecord, options: { appName?: string } = {}): string {
  const appName = options.appName ?? "FitTrack Go"
  const when = run.completedAt || new Date().toISOString()
  const points = run.path
    .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map(([lat, lon]) => `      <trkpt lat="${lat}" lon="${lon}"><time>${when}</time></trkpt>`)
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${xmlEscape(appName)}"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${xmlEscape(`Run ${run.id}`)}</name>
    <time>${when}</time>
  </metadata>
  <trk>
    <name>${xmlEscape(`Run ${run.distance.toFixed(2)}km`)}</name>
    <trkseg>
${points || "      <!-- no GPS samples -->"}
    </trkseg>
  </trk>
</gpx>
`
}

export type ExportBundle = {
  version: 1
  exportedAt: string
  profile: UserProfile | null
  workouts: WorkoutRecord[]
  runs: RunRecord[]
  coachSessions: CoachRecord[]
}

export function buildExportBundle(data: {
  profile: UserProfile | null
  workouts: WorkoutRecord[]
  runs: RunRecord[]
  coachSessions: CoachRecord[]
}): ExportBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: data.profile,
    workouts: data.workouts,
    runs: data.runs,
    coachSessions: data.coachSessions,
  }
}

/** Trigger a browser download for a text/blob payload. Works in client components. */
export function downloadBlob(filename: string, content: BlobPart, mimeType: string): void {
  if (typeof window === "undefined") return
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
