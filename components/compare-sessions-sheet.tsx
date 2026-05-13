"use client"

import type { CoachRecord, RunRecord } from "@/lib/store"
import type { Locale } from "@/lib/i18n"
import { compareCoachSessions, formatDeltaChip } from "@/lib/compare-sessions"
import { composeRunVersusShareFile } from "@/lib/share-card"
import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function CompareSessionsPanel({ current, baseline }: { current: CoachRecord; baseline: CoachRecord }) {
  let cmp: ReturnType<typeof compareCoachSessions>
  try {
    cmp = compareCoachSessions(current, baseline)
  } catch {
    return (
      <p className="text-xs text-muted-foreground rounded-xl border border-border bg-muted/20 p-3">
        Pick two sessions from the same exercise to compare joints and pacing.
      </p>
    )
  }

  const bottomEntries = Object.entries(cmp.bottomAnglesDelta).sort((a, b) => a[0].localeCompare(b[0]))
  const topEntries = Object.entries(cmp.topAnglesDelta).sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-typo-eyebrow font-bold uppercase tracking-wider text-primary">Session compare</span>
        <span className="rounded-full bg-card px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground border border-border">
          Form {formatDeltaChip(cmp.scoreDelta)}
        </span>
        {cmp.avgRepDelta != null ? (
          <span className="rounded-full bg-card px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground border border-border">
            Avg rep {formatDeltaChip(cmp.avgRepDelta, "%")}
          </span>
        ) : null}
      </div>
      {bottomEntries.length + topEntries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No joint traces on these rows yet — complete a few more coached sets to unlock angle deltas.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {bottomEntries.length ? (
            <div>
              <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Bottom phase Δ°
              </p>
              <ul className="space-y-1 text-xs">
                {bottomEntries.slice(0, 8).map(([k, v]) => (
                  <li key={`b-${k}`} className="flex justify-between gap-2 font-mono tabular-nums">
                    <span className="text-muted-foreground">{k}</span>
                    <span className={v >= 0 ? "text-primary" : "text-destructive"}>
                      {v > 0 ? "+" : ""}
                      {v}°
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {topEntries.length ? (
            <div>
              <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Top phase Δ°
              </p>
              <ul className="space-y-1 text-xs">
                {topEntries.slice(0, 8).map(([k, v]) => (
                  <li key={`t-${k}`} className="flex justify-between gap-2 font-mono tabular-nums">
                    <span className="text-muted-foreground">{k}</span>
                    <span className={v >= 0 ? "text-primary" : "text-destructive"}>
                      {v > 0 ? "+" : ""}
                      {v}°
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

/** Share a cinematic 1:1 “Versus” PNG comparing two runs (history detail). */
export function RunVersusShareCard({
  anchor,
  opponentCandidates,
  locale,
}: {
  anchor: RunRecord
  opponentCandidates: RunRecord[]
  locale: Locale
}) {
  const rivals = useMemo(
    () => opponentCandidates.filter((r) => r.id !== anchor.id),
    [opponentCandidates, anchor.id],
  )
  const [pickId, setPickId] = useState<string>("")

  useEffect(() => {
    const next = rivals[0]?.id ?? ""
    setPickId(next)
  }, [anchor.id, rivals])

  async function handleShareVersus() {
    const opp = rivals.find((r) => r.id === pickId) ?? rivals[0]
    if (!opp) {
      toast.error("Pick another saved run first.")
      return
    }
    const youLabel = format(new Date(anchor.completedAt), "EEE, MMM d")
    const oppLabel = format(new Date(opp.completedAt), "EEE, MMM d")

    try {
      const png = await composeRunVersusShareFile(
        {
          distanceKm: anchor.distance,
          durationSec: anchor.duration,
          pacePerKm: anchor.pace,
          dateLabel: youLabel,
          path: anchor.path ?? [],
        },
        {
          distanceKm: opp.distance,
          durationSec: opp.duration,
          pacePerKm: opp.pace,
          dateLabel: oppLabel,
          path: opp.path ?? [],
        },
        { locale },
      )

      const text = `Versus: ${anchor.distance.toFixed(2)} km vs ${opp.distance.toFixed(2)} km · FitTrack Go`
      if (png && navigator.share && navigator.canShare?.({ files: [png] })) {
        await navigator.share({ title: "FitTrack Go · Versus", text, files: [png] })
        toast.success("Shared")
        return
      }
      if (png && navigator.share) {
        await navigator.share({ title: "FitTrack Go · Versus", text })
        return
      }
      await navigator.clipboard.writeText(text)
      toast.success("Copied recap text")
    } catch {
      try {
        await navigator.clipboard.writeText(`Versus · FitTrack Go`)
        toast.success("Copied recap text")
      } catch {
        toast.error("Could not share versus card")
      }
    }
  }

  if (rivals.length === 0) return null

  return (
    <div className="rounded-2xl border border-[color-mix(in_oklab,var(--metric-run)_40%,transparent)] bg-metric-run/12 p-4">
      <p className="text-typo-eyebrow font-bold uppercase tracking-wider text-metric-run">Versus Card</p>
      <label className="mt-3 block">
        <span className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">Compare with</span>
        <select
          className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary"
          value={pickId}
          onChange={(e) => setPickId(e.target.value)}
          aria-label="Opponent run for versus share card"
        >
          {rivals.map((r) => (
            <option key={r.id} value={r.id}>
              {format(new Date(r.completedAt), "MMM d, p")} · {r.distance.toFixed(2)} km · {r.pace}/km
            </option>
          ))}
        </select>
      </label>
      <Button type="button" className="mt-4 w-full rounded-xl gap-2" variant="outline" onClick={() => void handleShareVersus()}>
        Share versus (PNG)
      </Button>
    </div>
  )
}
