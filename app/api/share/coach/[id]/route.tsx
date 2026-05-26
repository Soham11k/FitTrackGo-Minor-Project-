import { ImageResponse } from "next/og"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { RepTracePair } from "@/lib/rep-trace"
import { aggregateTopFaults, parseRepTracesJson } from "@/lib/rep-trace"

export const runtime = "edge"

const BEBAS_WOFF2 =
  "https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXooxWtrzAbj.woff2"

async function loadBebasFont(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(BEBAS_WOFF2, { headers: { Accept: "*/*" } })
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<ImageResponse | Response> {
  if (process.env.FITTRACK_DISABLE_PUBLIC_COACH_SHARE === "1" || process.env.FITTRACK_DISABLE_PUBLIC_RUN_SHARE === "1") {
    return Response.json({ error: "sharing_disabled" }, { status: 404 })
  }
  const admin = createServiceRoleClient()
  const { id } = await ctx.params
  if (!admin || !id) {
    return Response.json({ error: "Unavailable" }, { status: 503 })
  }

  const { data, error } = await admin
    .from("coach_sessions")
    .select("exercise, score, rep_scores, rep_traces")
    .eq("id", id)
    .maybeSingle()

  if (error || !data) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }

  const exercise = typeof data.exercise === "string" ? data.exercise : "Coach session"
  const scoreRaw = typeof data.score === "number" ? data.score : Number.parseFloat(String(data.score ?? "0"))
  const scoreNum = Number.isFinite(scoreRaw) ? Math.round(scoreRaw) : 0
  const repScores = Array.isArray(data.rep_scores) ? (data.rep_scores.filter((x) => typeof x === "number") as number[]) : []
  const traces: RepTracePair[] = parseRepTracesJson((data as { rep_traces?: unknown }).rep_traces)
  const faults = aggregateTopFaults(traces, 3)
  const maxBar = Math.max(...repScores, 1)

  const lastBottom = traces[traces.length - 1]?.bottom?.anglesDeg
  const kneeL = lastBottom?.["knee.l"]
  const kneeR = lastBottom?.["knee.r"]
  let kneeLine = ""
  if (typeof kneeL === "number" && typeof kneeR === "number") {
    const avg = (kneeL + kneeR) / 2
    kneeLine = `Knee (bottom avg): ${Math.round(avg)}°`
  } else {
    const elbowL = lastBottom?.["elbow.l"]
    const elbowR = lastBottom?.["elbow.r"]
    if (typeof elbowL === "number" && typeof elbowR === "number") {
      kneeLine = `Elbow (bottom avg): ${Math.round((elbowL + elbowR) / 2)}°`
    }
  }

  const barCount = Math.min(repScores.length, 28)

  const bebas = await loadBebasFont()
  const fonts = bebas
    ? [{ name: "Bebas Neue", data: bebas, style: "normal" as const, weight: 400 as const }]
    : []

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          padding: "56px",
          border: "2px solid rgba(34,197,94,0.55)",
          fontFamily: '"Bebas Neue", ui-sans-serif, system-ui',
        }}
      >
        <div style={{ fontSize: 26, opacity: 0.78 }}>FITTRACK GO · TRAIN WITH PROOF</div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 18 }}>
          <div style={{ fontSize: 80, letterSpacing: -2, textTransform: "uppercase", lineHeight: 1 }}>
            {scoreNum}%
          </div>
          <div style={{ fontFamily: "ui-sans-serif, system-ui", fontSize: 44, opacity: 0.92 }}>{exercise}</div>
          {kneeLine ? (
            <div style={{ fontSize: 34, opacity: 0.85 }}>
              Joints · {kneeLine}
            </div>
          ) : null}
          <div style={{ fontSize: 30, opacity: 0.7 }}>{repScores.length} reps traced</div>
          {faults.length > 0 ? (
            <div style={{ marginTop: 8, fontSize: 30, fontWeight: 600, color: "#fecaca" }}>
              Focus next: {faults[0]?.slice(0, 90)}
              {faults[0] && faults[0].length > 90 ? "…" : ""}
              {faults[1]
                ? ` · ${faults[1]?.slice(0, 72)}${faults[1] && faults[1].length > 72 ? "…" : ""}`
                : ""}
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 6,
            height: 200,
          }}
        >
          {repScores.slice(0, barCount).map((s, i) => {
            const h = Math.round((s / maxBar) * 180) + 8
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h}px`,
                  minWidth: 6,
                  background: "#22c55e",
                  borderRadius: 4,
                }}
              />
            )
          })}
        </div>
        <div style={{ marginTop: 16, fontSize: 26, opacity: 0.55 }}>
          Train with proof — rep traces · no raw video shared here
        </div>
      </div>
    ),
    { width: 1080, height: 1350, fonts },
  )
}
